/* M-academy OOXML / ZIP utilities. Browser-only; no network calls. */
(function(){
 "use strict";
 const enc=new TextEncoder();
 function escapeXML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]))}
 const table=new Uint32Array(256);
 for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?0xEDB88320^(c>>>1):c>>>1;table[i]=c>>>0}
 function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=table[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
 function header(size,fn){const b=new Uint8Array(size);fn(new DataView(b.buffer));return b}
 function asBytes(value){if(value instanceof Uint8Array)return value;if(value instanceof ArrayBuffer)return new Uint8Array(value);return enc.encode(String(value))}
 function zip(entries){
  const chunks=[],central=[];let offset=0;
  for(const [filename,value] of entries){
   const name=enc.encode(filename),data=asBytes(value),crc=crc32(data);
   const lh=header(30+name.length,v=>{v.setUint32(0,0x04034B50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true)});lh.set(name,30);chunks.push(lh,data);
   const ch=header(46+name.length,v=>{v.setUint32(0,0x02014B50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x0800,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true)});ch.set(name,46);central.push(ch);offset+=lh.length+data.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0);
  const end=header(22,v=>{v.setUint32(0,0x06054B50,true);v.setUint16(8,entries.length,true);v.setUint16(10,entries.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true)});
  return new Blob([...chunks,...central,end],{type:"application/zip"});
 }
 function run(text,{bold=false,size=22}={}){
  const runProp='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>'+(bold?'<w:b/>':'')+'<w:sz w:val="'+size+'"/></w:rPr>';
  return String(text??"").split(/\r?\n/).map(s=>'<w:r>'+runProp+'<w:t xml:space="preserve">'+escapeXML(s)+'</w:t></w:r>').join('<w:r><w:br/></w:r>');
 }
 function p(text,{bold=false,center=false,size=22,before=0,after=110}={}){
  return '<w:p><w:pPr><w:spacing w:before="'+before+'" w:after="'+after+'"/>'+(center?'<w:jc w:val="center"/>':'')+'</w:pPr>'+run(text,{bold,size})+'</w:p>';
 }
 function tc(value,width,{bold=false,size=20}={}){
  return '<w:tc><w:tcPr><w:tcW w:w="'+width+'" w:type="dxa"/><w:tcMar><w:top w:w="100" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tcMar></w:tcPr>'+p(value,{bold,size})+'</w:tc>';
 }
 function tbl(rows,widths,{headerRow=true}={}){
  const grid=widths.map(w=>'<w:gridCol w:w="'+w+'"/>').join("");
  const rs=rows.map((row,i)=>'<w:tr><w:trPr><w:cantSplit/>'+(i===0&&headerRow?'<w:tblHeader w:val="true"/>':'')+'</w:trPr>'+row.map((cell,j)=>tc(cell,widths[j],{bold:i===0&&headerRow})).join('')+'</w:tr>').join('');
  return '<w:tbl><w:tblPr><w:tblBorders>'+["top","left","bottom","right","insideH","insideV"].map(v=>'<w:'+v+' w:val="single" w:sz="5"/>').join('')+'</w:tblBorders></w:tblPr><w:tblGrid>'+grid+'</w:tblGrid>'+rs+'</w:tbl>';
 }
 function docx(blocks,{landscape=false}={}){
  let body="";
  for(const block of blocks){
   if(block.type==="pagebreak"){body+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';continue}
   if(block.type==="table")body+=tbl(block.rows,block.widths,{headerRow:block.headerRow!==false});
   else body+=p(block.text||"",{center:block.type==="title",bold:block.type==="title"||block.type==="heading"||block.bold,size:block.type==="title"?30:block.type==="heading"?25:22,before:block.type==="heading"?180:0});
  }
  const size=landscape?'<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>':'<w:pgSz w:w="11906" w:h="16838"/>';
  body+='<w:sectPr>'+size+'<w:pgMar w:top="850" w:right="780" w:bottom="850" w:left="780" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr>';
  const document='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+body+'</w:body></w:document>';
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const blob=zip([["[Content_Types].xml",types],["_rels/.rels",rels],["word/document.xml",document]]);
  return blob.arrayBuffer().then(buf=>new Uint8Array(buf));
 }
 function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 window.MAcademyDocs={zip,docx,download,escapeXML};
})();