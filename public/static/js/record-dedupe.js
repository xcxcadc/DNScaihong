/* Shared comparison rules for DNS import and record-list duplicate review. */
(function(root, factory){
    if(typeof module === 'object' && module.exports) module.exports = factory();
    else root.RecordDedupe = factory();
})(typeof window !== 'undefined' ? window : globalThis, function(){
    'use strict';
    function text(v){ return v === null || v === undefined ? '' : String(v).trim(); }
    function first(v){ return Array.isArray(v) ? v.join(',') : v; }
    function normalizedValue(row){
        var v = value(row);
        return type(row) === 'MX' ? v.replace(/\s+\|\s+\d+$/, '').replace(/\.$/, '') : v;
    }
    function type(row){ return text(row.Type !== undefined ? row.Type : row.type).toUpperCase(); }
    function name(row){ return text(row.Name !== undefined ? row.Name : row.name).toLowerCase().replace(/\.$/, ''); }
    function line(row){ return text(row.Line !== undefined ? row.Line : row.line); }
    function value(row){
        var v = text(first(row.Value !== undefined ? row.Value : row.value));
        if(type(row) === 'TXT' && v.length >= 2 && v[0] === '"' && v[v.length - 1] === '"') v = v.slice(1, -1);
        return ['CNAME','NS','PTR','MX'].indexOf(type(row)) >= 0 ? v.toLowerCase().replace(/\.$/, '') : v;
    }
    function mx(row){
        var valueText = text(first(row.Value !== undefined ? row.Value : row.value));
        var pipe = valueText.match(/\s+\|\s+(\d+)$/);
        return pipe ? pipe[1] : text(row.MX !== undefined ? row.MX : row.mx);
    }
    function id(row){ return text(row.RecordId !== undefined ? row.RecordId : row.id); }
    function exactKey(row){
        var t = type(row);
        var v = normalizedValue(row);
        return JSON.stringify([name(row), t, line(row), v, t === 'MX' ? mx(row) : '']);
    }
    function sameValueKey(row){
        var v = normalizedValue(row);
        return JSON.stringify([v]);
    }
    function group(rows){
        var groups = new Map();
        rows.forEach(function(row){
            var key = exactKey(row);
            if(!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
        });
        return Array.from(groups.values()).filter(function(group){ return group.length > 1; });
    }
    function sameValuePairs(rows){
        var values = new Map();
        rows.forEach(function(row){
            var key = sameValueKey(row);
            if(!values.has(key)) values.set(key, []);
            values.get(key).push(row);
        });
        return Array.from(values.values()).filter(function(group){
            return group.length > 1 && new Set(group.map(exactKey)).size > 1;
        });
    }
    async function fetchAll(domainId){
        var rows = [], expected = null, pageSize = 100, pages = 0, ids = new Set();
        while(true){
            pages++;
            if(pages > 1000) throw new Error('记录超过 100000 条，无法安全完成查重');
            var response = await $.ajax({type:'POST',url:'/record/snapshot/' + domainId,
                data:{page:pages},dataType:'json'});
            if(!response || response.code !== 0 || !Array.isArray(response.rows))
                throw new Error(response && response.msg ? response.msg : '获取解析记录失败');
            if(expected === null){
                expected = Number(response.total);
                if(!Number.isInteger(expected) || expected < 0 || expected > 100000)
                    throw new Error('记录总数不合法或超过 100000 条');
            }
            if(Number(response.total) !== expected) throw new Error('查重期间记录数量发生变化，请重试');
            response.rows.forEach(function(row){
                var recordId = id(row);
                if(!recordId || ids.has(recordId)) throw new Error('记录分页重复或缺少 ID，请重试');
                ids.add(recordId);
            });
            rows.push.apply(rows, response.rows);
            if(rows.length >= expected) break;
            if(!response.rows.length) throw new Error('记录分页不完整，请重试');
        }
        if(rows.length !== expected) throw new Error('记录总数与查询结果不一致，请重试');
        return rows;
    }
    return {exactKey:exactKey, sameValueKey:sameValueKey, group:group, sameValuePairs:sameValuePairs, fetchAll:fetchAll,
        id:id, name:name, type:type, value:value, line:line, mx:mx};
});
