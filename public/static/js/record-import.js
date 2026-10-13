/* DNS record import parser. No file contents are sent to the server until confirmation. */
(function(root, factory){
    if(typeof module === 'object' && module.exports) module.exports = factory();
    else root.RecordImportParser = factory();
})(typeof window !== 'undefined' ? window : globalThis, function(){
    'use strict';

    var types = ['A','AAAA','CNAME','MX','TXT','NS','SOA','SRV','CAA','PTR','HTTPS','SVCB','SSHFP','DS','TLSA','NAPTR','REDIRECT_URL','FORWARD_URL'];
    var aliases = {
        name: ['主机记录','主机名','主机','记录名','名称','域名','子域名','name','host','hostname','subdomain','rr','recordname','record_name','domain','fqdn','recordsetname'],
        type: ['记录类型','类型','type','recordtype','record_type','dns_type'],
        value: ['记录值','记录内容','解析值','目标地址','值','content','value','recordvalue','record_value','target','answer','records','recorddata','record_data'],
        line: ['线路类型','线路','解析线路','线路值','line','linename','recordline','record_line','view'],
        ttl: ['ttl','生存时间','缓存时间','time_to_live'],
        weight: ['权重','weight'],
        mx: ['mx','priority','优先级','mx优先级','mx_priority'],
        remark: ['备注','描述','remark','comment','description'],
        status: ['状态','status','enable_status'],
        proxied: ['代理状态','代理','proxied','proxy_status']
    };
    var providerLabels = {auto:'自动识别', dnspod:'腾讯云 DNSPod', aliyun:'阿里云 DNS', huawei:'华为云 DNS', cloudflare:'Cloudflare', generic:'通用格式'};

    function str(value){ return value === null || value === undefined ? '' : String(value).trim(); }
    function key(value){ return str(value).replace(/^\uFEFF/, '').toLowerCase().replace(/[\s_\-（）()：:]+/g, ''); }
    function fieldFor(header){
        var normalized = key(header);
        for(var field in aliases){
            if(aliases[field].some(function(a){ return key(a) === normalized; })) return field;
        }
        return '';
    }
    function providerName(provider){ return providerLabels[provider] || provider; }
    function sourceLine(line, provider){
        var value = str(line);
        if(!value) return '默认';
        if(provider === 'cloudflare'){
            if(value === '1' || value === 'true') return '已代理';
            if(value === '0' || value === 'false') return '仅DNS';
        }
        var common = {'default':'默认','default_view':'默认','0':'默认','默认':'默认',
            'telecom':'电信','ct':'电信','dianxin':'电信','10=0':'电信',
            'unicom':'联通','cnc':'联通','liantong':'联通','10=1':'联通',
            'mobile':'移动','cmnet':'移动','yidong':'移动','10=3':'移动',
            'oversea':'境外','abroad':'境外','3=0':'境外'};
        if(provider === 'huawei' && value === 'Dianxin') return '电信';
        return common[value.toLowerCase()] || value;
    }
    function normalizeName(raw, domain){
        var name = str(raw).replace(/\.$/, '');
        var zone = str(domain).replace(/\.$/, '');
        if(!name) return '';
        if(name === '@') return '@';
        if(zone && name.toLowerCase() === zone.toLowerCase()) return '@';
        if(zone && name.toLowerCase().slice(-zone.length - 1) === '.' + zone.toLowerCase()) return name.slice(0, -zone.length - 1);
        if(name.indexOf('.') !== -1 && zone && name.toLowerCase().endsWith('.' + zone.toLowerCase()) === false){
            throw new Error('记录域名不属于当前域名：' + name);
        }
        return name;
    }
    function normalizeRecord(raw, domain){
        var result = {name:'',type:'',value:'',line:'',ttl:'',weight:'',mx:'',remark:'',disabled:false,proxied:'',error:''};
        Object.keys(result).forEach(function(k){ if(raw[k] !== undefined && raw[k] !== null) result[k] = raw[k]; });
        try{ result.name = normalizeName(result.name, domain); }
        catch(e){ result.error = e.message; result.name = str(raw.name); }
        result.type = str(result.type).toUpperCase();
        result.value = Array.isArray(result.value) ? result.value.map(str).join(',') : str(result.value);
        result.line = str(result.line);
        result.ttl = str(result.ttl);
        result.weight = str(result.weight);
        result.mx = str(result.mx);
        result.remark = str(result.remark);
        if(result.type === 'CNAME' || result.type === 'NS' || result.type === 'MX' || result.type === 'PTR') result.value = result.value.replace(/\.$/, '');
        if(result.type === 'MX' && result.mx && result.value.indexOf(' | ') === -1) result.value += ' | ' + result.mx;
        var status = str(raw.status).toLowerCase();
        result.disabled = raw.disabled === true || ['0','false','disabled','disable','paused','pause','暂停','停用','禁用'].indexOf(status) !== -1;
        if(raw.proxied !== '' && raw.proxied !== undefined && raw.proxied !== null)
            result.proxied = raw.proxied === true || ['1','true','yes','是','已代理','开启'].indexOf(str(raw.proxied).toLowerCase()) !== -1;
        if(result.type && types.indexOf(result.type) === -1 && result.type !== '显性URL' && result.type !== '隐性URL')
            result.error = result.error || '不支持的记录类型：' + result.type;
        return result;
    }
    function detectProvider(headers, selected){
        if(selected && selected !== 'auto' && selected !== 'generic') return selected;
        var joined = headers.map(key).join('|');
        if(/content|proxied|modifiedon|zoneid/.test(joined)) return 'cloudflare';
        if(/recordline|mx优先级|recordlineid/.test(joined)) return 'dnspod';
        if(/\brr\b|recordid/.test(joined)) return 'aliyun';
        if(/recordsets|records|description/.test(joined)) return 'huawei';
        return 'generic';
    }
    function mapObjects(objects, selected, domain, format){
        if(!Array.isArray(objects) || !objects.length) throw new Error('未找到解析记录');
        if(objects.length > 5000) throw new Error('单次最多导入 5000 条记录');
        var headers = Object.keys(objects[0]);
        var provider = detectProvider(headers, selected);
        var mappedHeaders = headers.map(fieldFor);
        if(selected === 'auto' && provider === 'generic'){
            var lineKey = headers.find(function(header){ return fieldFor(header) === 'line'; });
            if(lineKey && objects.some(function(item){ return ['已代理','仅DNS','仅dns'].indexOf(str(item[lineKey])) !== -1; })) provider = 'cloudflare';
        }
        if(mappedHeaders.indexOf('name') === -1 || mappedHeaders.indexOf('type') === -1 || mappedHeaders.indexOf('value') === -1)
            throw new Error('无法识别主机记录、记录类型或记录值列，请检查文件表头');
        return {provider:provider, format:format, rows:objects.map(function(item){
            var raw = {};
            headers.forEach(function(header, i){ if(mappedHeaders[i] && (raw[mappedHeaders[i]] === undefined || raw[mappedHeaders[i]] === '')) raw[mappedHeaders[i]] = item[header]; });
            if((raw.name === '' || raw.name === undefined) && !raw.type && !raw.value) return null;
            return normalizeRecord(raw, domain);
        }).filter(Boolean)};
    }
    function parseDelimited(text, delimiter){
        var rows = [], row = [], cell = '', quoted = false;
        for(var i = 0; i < text.length; i++){
            var ch = text[i];
            if(ch === '"'){
                if(quoted && text[i + 1] === '"'){ cell += '"'; i++; }
                else quoted = !quoted;
            }else if(ch === delimiter && !quoted){ row.push(cell); cell = ''; }
            else if((ch === '\n' || ch === '\r') && !quoted){
                if(ch === '\r' && text[i + 1] === '\n') i++;
                row.push(cell); if(row.some(function(v){ return str(v) !== ''; })) rows.push(row);
                row = []; cell = '';
            }else cell += ch;
        }
        if(quoted) throw new Error('文本中的引号未闭合');
        row.push(cell); if(row.some(function(v){ return str(v) !== ''; })) rows.push(row);
        return rows;
    }
    function rowsToObjects(rows){
        var headerIndex = -1;
        for(var i = 0; i < Math.min(rows.length, 30); i++){
            var fields = rows[i].map(fieldFor);
            if(fields.indexOf('name') !== -1 && fields.indexOf('type') !== -1 && fields.indexOf('value') !== -1){ headerIndex = i; break; }
        }
        if(headerIndex === -1) throw new Error('找不到包含主机记录、记录类型、记录值的表头');
        var headers = rows[headerIndex].map(str);
        return rows.slice(headerIndex + 1).filter(function(row){
            return row.some(function(v){ return str(v) !== ''; }) && !/^#|^;|^\/\//.test(str(row[0]));
        }).map(function(row){
            var obj = {}; headers.forEach(function(header, index){ obj[header] = row[index] === undefined ? '' : row[index]; }); return obj;
        });
    }
    function parseTable(text, selected, domain){
        var lines = text.split(/\r?\n/).filter(function(line){ return str(line) && !/^\s*(#|;|\/\/)/.test(line); });
        if(!lines.length) throw new Error('文件没有可读取的内容');
        var delimiters = ['\t', ',', ';', '|'];
        for(var i = 0; i < delimiters.length; i++){
            try{
                var objects = rowsToObjects(parseDelimited(text.replace(/^\uFEFF/, ''), delimiters[i]));
                return mapObjects(objects, selected, domain,
                    delimiters[i] === '\t' ? 'TSV/TXT 表格' : 'CSV/TXT 表格');
            }catch(e){
                if(e.message !== '找不到包含主机记录、记录类型、记录值的表头') throw e;
            }
        }
        try{
            return mapObjects(rowsToObjects(lines.map(function(line){ return line.trim().split(/\s{2,}/); })),
                selected, domain, 'TXT 空格表格');
        }catch(e){
            if(e.message !== '找不到包含主机记录、记录类型、记录值的表头') throw e;
        }
        throw new Error('找不到包含主机记录、记录类型、记录值的表头，或分隔符不受支持');
    }
    function zoneTtl(value){
        var text = str(value);
        if(/^\d+$/.test(text)) return text;
        var unit = {w:604800,d:86400,h:3600,m:60,s:1};
        var parts = text.toLowerCase().match(/\d+[wdhms]/g);
        if(!parts || parts.join('') !== text.toLowerCase()) return text;
        return String(parts.reduce(function(total, part){ return total + parseInt(part, 10) * unit[part.slice(-1)]; }, 0));
    }
    function tokenizeZone(line){
        var tokens = [], token = '', quoted = false, escaped = false;
        for(var i = 0; i < line.length; i++){
            var ch = line[i];
            if(escaped){ token += ch; escaped = false; continue; }
            if(ch === '\\'){ escaped = true; continue; }
            if(ch === '"'){ quoted = !quoted; continue; }
            if(ch === ';' && !quoted) break;
            if(/\s|[()]/.test(ch) && !quoted){ if(token){ tokens.push(token); token = ''; } }
            else token += ch;
        }
        if(token) tokens.push(token);
        return tokens;
    }
    function parseZone(text, selected, domain){
        var origin = str(domain).replace(/\.$/, ''), defaultTtl = '', lastName = '', rows = [];
        var lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
        for(var i = 0; i < lines.length; i++){
            var line = lines[i], trimmed = str(line);
            if(!trimmed || /^;|^#|^\/\//.test(trimmed)) continue;
            var tokens = tokenizeZone(line);
            if(!tokens.length) continue;
            if(tokens[0].toUpperCase() === '$ORIGIN'){ origin = str(tokens[1]).replace(/\.$/, ''); continue; }
            if(tokens[0].toUpperCase() === '$TTL'){ defaultTtl = zoneTtl(tokens[1]); continue; }
            if(tokens[0][0] === '$') continue;
            var pos = 0, owner;
            if(/^\s/.test(line)) owner = lastName;
            else { owner = tokens[pos++]; lastName = owner; }
            var ttl = defaultTtl;
            while(pos < tokens.length && (tokens[pos].toUpperCase() === 'IN' || /^\d+[wdhms]?$/i.test(tokens[pos]))){
                if(/^\d+[wdhms]?$/i.test(tokens[pos])) ttl = zoneTtl(tokens[pos]);
                pos++;
            }
            var type = str(tokens[pos++]).toUpperCase();
            if(types.indexOf(type) === -1) continue;
            var rest = tokens.slice(pos);
            if(!rest.length) continue;
            var raw = {name:owner,type:type,value:rest.join(' '),ttl:ttl};
            if(type === 'MX'){ raw.mx = rest.shift(); raw.value = rest.join(' '); }
            if(owner === '@') raw.name = origin;
            else if(owner.slice(-1) !== '.') raw.name = owner + '.' + origin;
            if(['CNAME','NS','MX','PTR'].indexOf(type) !== -1){
                if(raw.value === '@') raw.value = origin;
                else if(raw.value && raw.value.slice(-1) !== '.') raw.value += '.' + origin;
                raw.value = raw.value.replace(/\.$/, '');
            }
            if(/(?:cf-proxied|proxied)\s*[:=]\s*true/i.test(line)) raw.proxied = true;
            rows.push(normalizeRecord(raw, domain));
            if(rows.length > 5000) throw new Error('单次最多导入 5000 条记录');
        }
        if(!rows.length) throw new Error('未识别到 BIND Zone 解析记录');
        var provider = selected === 'auto' ? (/(?:cf-proxied|cf_tags|cloudflare)/i.test(text) ? 'cloudflare' : 'generic') : selected;
        return {provider:provider, format:'BIND Zone/TXT', rows:rows};
    }
    function parseJson(text, selected, domain){
        var data = JSON.parse(text), records = data;
        if(data && !Array.isArray(data)) records = data.result || data.records || data.RecordList || data.DomainRecords || data.recordsets || data.data;
        if(records && !Array.isArray(records)) records = records.Records || records.Record || records.records || records.list || records.items;
        if(!Array.isArray(records)) throw new Error('JSON 中没有可识别的解析记录数组');
        return mapObjects(records, selected, domain, 'JSON');
    }
    function decode(bytes){
        if(bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes);
        if(bytes[0] === 0xFE && bytes[1] === 0xFF){
            var swapped = new Uint8Array(bytes.length - 2);
            for(var i = 2; i + 1 < bytes.length; i += 2){ swapped[i-2] = bytes[i+1]; swapped[i-1] = bytes[i]; }
            return new TextDecoder('utf-16le').decode(swapped);
        }
        try{ return new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
        catch(e){ return new TextDecoder('gb18030').decode(bytes); }
    }
    function parse(bytes, filename, selected, domain, xlsx){
        var ext = str(filename).split('.').pop().toLowerCase();
        if(['xlsx','xls'].indexOf(ext) !== -1){
            if(!xlsx) throw new Error('Excel 组件加载失败');
            var book = xlsx.read(bytes, {type:'array'});
            if(!book.SheetNames.length) throw new Error('Excel 中没有工作表');
            return mapObjects(xlsx.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], {defval:'',raw:false}), selected, domain, 'Excel');
        }
        if(['csv','tsv','txt','zone','json'].indexOf(ext) === -1) throw new Error('不支持的文件扩展名：' + ext);
        var content = decode(bytes).replace(/^\uFEFF/, '');
        if(ext === 'json' || /^[\s]*[\[{]/.test(content)) return parseJson(content, selected, domain);
        if(ext === 'zone' || /(^|\n)\s*\$ORIGIN\b/i.test(content) || /(^|\n)\s*[^\n,\t]+\s+(?:\d+[wdhms]?\s+)?IN\s+(A|AAAA|CNAME|MX|TXT|NS|SOA|SRV|CAA)\b/i.test(content))
            return parseZone(content, selected, domain);
        return parseTable(content, selected, domain);
    }
    return {parse:parse, sourceLine:sourceLine, providerName:providerName};
});
