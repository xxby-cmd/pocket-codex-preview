// The phone receives at most two turns and a bounded payload per page.
export function historyPage(thread, cursor=null) {
  const rows=[];
  for(const turn of thread.turns||[]) for(const item of turn.items||[]) {
    if(!['userMessage','agentMessage'].includes(item.type))continue;
    const text=item.text||item.content?.filter(x=>x.type==='text').map(x=>x.text).join('\n')||'';
    // Split even a single very long message without losing any text.
    const chars=Array.from(text); const chunks=Math.max(1,Math.ceil(chars.length/6000));
    for(let part=0;part<chunks;part++)rows.push({id:`${turn.id}:${item.id}:${part}`,turnId:turn.id,role:item.type==='userMessage'?'user':'assistant',text:chars.slice(part*6000,(part+1)*6000).join(''),part,parts:chunks});
  }
  let end=rows.length;
  if(cursor!==null){end=rows.findIndex(x=>x.id===cursor);if(end<0)throw Error('历史记录已变化，请重新打开会话后加载');}
  const messages=[],turns=new Set();let bytes=0,start=end;
  while(start>0){const row=rows[start-1];if(!turns.has(row.turnId)&&turns.size>=2)break;const size=Buffer.byteLength(JSON.stringify(row));if(messages.length&&bytes+size>90000)break;turns.add(row.turnId);messages.unshift(row);bytes+=size;start--;}
  return {id:thread.id,name:thread.name,messages,cursor:start>0?rows[start].id:null,hasMore:start>0,turns:thread.turns?.length||0};
}
