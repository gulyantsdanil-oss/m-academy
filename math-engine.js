/* Shared mathematics engine: deterministic, browser-only. */
(function(){
"use strict";
const fmt=x=>Number.isInteger(x)?String(x):Number(x.toFixed(6)).toString();
const signed=x=>x>=0?"+ "+x:"− "+Math.abs(x);
function rngFor(s){let seed=s>>>0;return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}};
function integer(rand,lo,hi){return lo+Math.floor(rand()*(hi-lo+1))}
function nonzero(rand,lo,hi){let n=0;while(!n)n=integer(rand,lo,hi);return n}
const nth=(a,d,n)=>a+(n-1)*d;
function progression(level,r){
 const a=integer(r,-12,15),d=nonzero(r,-7,7),n=integer(r,6,17),x=nth(a,d,n);
 if(level==="A"){const q=integer(r,3,7);return {q:{ru:"В арифметической прогрессии a₁ = "+a+", d = "+d+". Найдите a"+q+".",kk:"Арифметикалық прогрессияда a₁ = "+a+", d = "+d+". a"+q+" табыңыз."},ans:nth(a,d,q),solution:"a"+q+" = "+a+" + ("+q+" − 1)·("+d+") = "+nth(a,d,q)}}
 if(level==="B")return {q:{ru:"Найдите a"+n+" арифметической прогрессии, если a₁ = "+a+" и d = "+d+".",kk:"a₁ = "+a+" және d = "+d+" болса, арифметикалық прогрессияның a"+n+" мүшесін табыңыз."},ans:x,solution:"a"+n+" = "+a+" + ("+n+" − 1)·("+d+") = "+x};
 const i=integer(r,2,5),j=i+integer(r,3,7),ai=nth(a,d,i),aj=nth(a,d,j);
 return {q:{ru:"Для арифметической прогрессии a"+i+" = "+ai+", a"+j+" = "+aj+". Найдите a₁.",kk:"Арифметикалық прогрессияда a"+i+" = "+ai+", a"+j+" = "+aj+". a₁ табыңыз."},ans:a,solution:"d = ("+aj+" − ("+ai+")) / ("+j+" − "+i+") = "+d+"; a₁ = "+ai+" − ("+i+" − 1)·("+d+") = "+a}
}
function quadratic(level,r){
 if(level==="A"){
  const k=integer(r,1,12);return {q:{ru:"Решите уравнение x² = "+k*k+". Укажите положительный корень.",kk:"x² = "+k*k+" теңдеуін шешіңіз. Оң түбірін көрсетіңіз."},ans:k,solution:"x = ±√"+(k*k)+" = ±"+k+"; положительный корень "+k};
 }
 const root=integer(r,-8,8),other=level==="C"?nonzero(r,-8,8):integer(r,-8,8);
 const b=-(root+other),c=root*other;
 if(level==="B")return{q:{ru:"Один корень уравнения x² "+signed(b)+"x "+signed(c)+" = 0 равен "+root+". Найдите второй корень.",kk:"x² "+signed(b)+"x "+signed(c)+" = 0 теңдеуінің бір түбірі "+root+". Екінші түбірін табыңыз."},ans:other,solution:"По Виету x₁ + x₂ = "+(-b)+"; x₂ = "+(-b)+" − ("+root+") = "+other};
 const factor=integer(r,2,4),B=b*factor,C=c*factor;
 return{q:{ru:"Уравнение "+factor+"x² "+signed(B)+"x "+signed(C)+" = 0 имеет корень "+root+". Найдите другой корень.",kk:factor+"x² "+signed(B)+"x "+signed(C)+" = 0 теңдеуінің бір түбірі "+root+". Екінші түбірін табыңыз."},ans:other,solution:"Делим на "+factor+": x² "+signed(b)+"x "+signed(c)+" = 0. Сумма корней = "+(-b)+"; второй корень "+other}
}
function rational(level,r){
 const a=nonzero(r,-12,12),b=nonzero(r,-12,12);
 if(level==="A"){const ans=a+b;return{q:{ru:"Вычислите: ("+a+") + ("+b+").",kk:"Есептеңіз: ("+a+") + ("+b+")."},ans,solution:a+" + ("+b+") = "+ans}}
 if(level==="B"){const ans=a*b;return{q:{ru:"Вычислите: ("+a+") · ("+b+").",kk:"Есептеңіз: ("+a+") · ("+b+")."},ans,solution:a+" · ("+b+") = "+ans}}
 const divisor=nonzero(r,-9,9),quotient=nonzero(r,-9,9),dividend=divisor*quotient;
 return{q:{ru:"Вычислите: ("+dividend+") : ("+divisor+").",kk:"Есептеңіз: ("+dividend+") : ("+divisor+")."},ans:quotient,solution:dividend+" : ("+divisor+") = "+quotient}
}
function percent(level,r){
 const p=integer(r,1,12)*5,base=integer(r,2,20)*20,part=base*p/100;
 if(level==="A")return{q:{ru:"Найдите "+p+"% от числа "+base+".",kk:base+" санының "+p+"%-ын табыңыз."},ans:part,solution:base+" · "+p+" / 100 = "+fmt(part)};
 if(level==="B"){const remain=base*(100-p)/100;return{q:{ru:"После скидки "+p+"% товар стоимостью "+base+" тг стоит сколько тенге?",kk:base+" теңгелік затқа "+p+"% жеңілдік жасалды. Жаңа бағасын табыңыз."},ans:remain,solution:base+" · (100 − "+p+") / 100 = "+fmt(remain)}}
 return{q:{ru:"Число "+fmt(part)+" составляет "+p+"% неизвестного числа. Найдите это число.",kk:fmt(part)+" саны белгісіз санның "+p+"%-ын құрайды. Белгісіз санды табыңыз."},ans:base,solution:fmt(part)+" · 100 / "+p+" = "+base}
}
function linear(level,r){
 const a=nonzero(r,-6,6),b=integer(r,-12,12),x=nonzero(r,-8,8),y=a*x+b;
 if(level==="A")return{q:{ru:"Для y = "+a+"x "+signed(b)+" найдите y при x = "+x+".",kk:"y = "+a+"x "+signed(b)+" функциясында x = "+x+" болса, y табыңыз."},ans:y,solution:"y = "+a+"·("+x+") "+signed(b)+" = "+y};
 if(level==="B")return{q:{ru:"Точка ("+x+"; "+y+") принадлежит графику y = kx "+signed(b)+". Найдите k.",kk:"("+x+"; "+y+") нүктесі y = kx "+signed(b)+" графигінде жатыр. k табыңыз."},ans:a,solution:"k = ("+y+" − ("+b+"))/("+x+") = "+a,requiresNonzeroX:true};
 const delta=nonzero(r,-6,6),y2=a*(x+delta)+b;
 return{q:{ru:"Линейная функция проходит через точки ("+x+"; "+y+") и ("+(x+delta)+"; "+y2+"). Найдите её угловой коэффициент k.",kk:"Сызықтық функция ("+x+"; "+y+") және ("+(x+delta)+"; "+y2+") нүктелерінен өтеді. k коэффициентін табыңыз."},ans:a,solution:"k = ("+y2+" − ("+y+")) / ("+(x+delta)+" − ("+x+")) = "+a};
}
function roots(level,r){
 const k=integer(r,2,16),square=k*k;
 if(level==="A")return{q:{ru:"Найдите арифметический квадратный корень из "+square+".",kk:square+" санының арифметикалық квадрат түбірін табыңыз."},ans:k,solution:"√"+square+" = "+k};
 if(level==="B"){const j=integer(r,1,10);return{q:{ru:"Вычислите √"+square+" + √"+j*j+".",kk:"√"+square+" + √"+j*j+" мәнін есептеңіз."},ans:k+j,solution:k+" + "+j+" = "+(k+j)}}
 const j=integer(r,1,10);return{q:{ru:"Вычислите √"+(k*k*j*j)+" / √"+j*j+".",kk:"√"+(k*k*j*j)+" / √"+j*j+" мәнін есептеңіз."},ans:k,solution:(k*j)+" / "+j+" = "+k}
}
function trig(level,r){
 const deg=[0,30,45,60,90,120,135,150,180,210,225,240,270,300,315,330][integer(r,0,15)];
 const val=Math.round(Math.sin(deg*Math.PI/180)*1e6)/1e6;
 if(level==="A")return{q:{ru:"Найдите sin "+deg+"° (ответ числом, допустима десятичная дробь).",kk:"sin "+deg+"° мәнін табыңыз (жауабы сан түрінде)."},ans:val,solution:"sin "+deg+"° = "+fmt(val)};
 if(level==="B"){
  const coef=integer(r,1,6),target=[-1,-0.5,0,0.5,1][integer(r,0,4)],rhs=coef*target;
  return{q:{ru:"Из уравнения "+coef+" sin x = "+fmt(rhs)+" найдите значение sin x.",kk:coef+" sin x = "+fmt(rhs)+" теңдеуінен sin x мәнін табыңыз."},ans:target,solution:"sin x = "+fmt(rhs)+" / "+coef+" = "+fmt(target)};
 }
 const shift=integer(r,1,7),target=[-1,-0.5,0,0.5,1][integer(r,0,4)],rhs=target+shift;
 return{q:{ru:"Если sin x + "+shift+" = "+fmt(rhs)+", найдите sin x.",kk:"sin x + "+shift+" = "+fmt(rhs)+" болса, sin x мәнін табыңыз."},ans:target,solution:"sin x = "+fmt(rhs)+" − "+shift+" = "+fmt(target)};
}

function fractions(level,r){
 const den=integer(r,2,12),multiple=integer(r,2,12),base=den*multiple;
 const numerator=integer(r,1,den-1),value=multiple*numerator;
 if(level==="A")return{q:{ru:"Найдите "+numerator+"/"+den+" от числа "+base+".",kk:base+" санының "+numerator+"/"+den+" бөлігін табыңыз."},ans:value,solution:base+" · "+numerator+"/"+den+" = "+value};
 if(level==="B")return{q:{ru:"Число "+value+" составляет "+numerator+"/"+den+" неизвестного числа. Найдите это число.",kk:value+" саны белгісіз санның "+numerator+"/"+den+" бөлігі. Белгісіз санды табыңыз."},ans:base,solution:value+" : ("+numerator+"/"+den+") = "+base};
 const plus=integer(r,1,den-1),val=multiple*(numerator+plus);
 return{q:{ru:"Вычислите ("+numerator+"/"+den+" + "+plus+"/"+den+") · "+base+".",kk:"("+numerator+"/"+den+" + "+plus+"/"+den+") · "+base+" есептеңіз."},ans:val,solution:"("+numerator+" + "+plus+")/"+den+" · "+base+" = "+val}
}
function proportion(level,r){
 const a=integer(r,2,10),b=integer(r,2,10),scale=integer(r,2,6),c=a*scale,d=b*scale;
 if(level==="A")return{q:{ru:"Найдите x из пропорции "+a+" : "+b+" = "+c+" : x.",kk:a+" : "+b+" = "+c+" : x пропорциясынан x табыңыз."},ans:d,solution:"x = "+b+" · "+c+" / "+a+" = "+d};
 if(level==="B")return{q:{ru:"Для пропорции "+a+"/"+b+" = x/"+d+" найдите x.",kk:a+"/"+b+" = x/"+d+" пропорциясында x табыңыз."},ans:c,solution:"x = "+a+" · "+d+" / "+b+" = "+c};
 return{q:{ru:"Известно, что "+a+" : x = "+c+" : "+d+". Найдите x.",kk:a+" : x = "+c+" : "+d+" болса, x табыңыз."},ans:b,solution:"x = "+a+" · "+d+" / "+c+" = "+b}
}
function powers(level,r){
 const base=integer(r,2,5),m=integer(r,2,4),n=integer(r,2,4);
 if(level==="A")return{q:{ru:"Вычислите "+base+"^"+m+".",kk:base+"^"+m+" мәнін есептеңіз."},ans:base**m,solution:base+"^"+m+" = "+(base**m)};
 if(level==="B")return{q:{ru:"Вычислите "+base+"^"+m+" · "+base+"^"+n+".",kk:base+"^"+m+" · "+base+"^"+n+" есептеңіз."},ans:base**(m+n),solution:base+"^("+m+" + "+n+") = "+(base**(m+n))};
 return{q:{ru:"Вычислите ("+base+"^"+m+")^"+n+" / "+base+"^"+(m*n-2)+".",kk:"("+base+"^"+m+")^"+n+" / "+base+"^"+(m*n-2)+" есептеңіз."},ans:base**2,solution:base+"^("+m*n+" − "+(m*n-2)+") = "+(base**2)}
}
function pythagoras(level,r){
 const triples=[[3,4,5],[5,12,13],[8,15,17],[7,24,25]],tri=triples[integer(r,0,triples.length-1)],scale=integer(r,1,4);
 const a=tri[0]*scale,b=tri[1]*scale,c=tri[2]*scale;
 if(level==="A")return{q:{ru:"Катеты прямоугольного треугольника "+a+" и "+b+". Найдите гипотенузу.",kk:"Тікбұрышты үшбұрыштың катеттері "+a+" және "+b+". Гипотенузасын табыңыз."},ans:c,solution:"c = √("+a+"² + "+b+"²) = "+c};
 if(level==="B")return{q:{ru:"Гипотенуза равна "+c+", один катет "+a+". Найдите другой катет.",kk:"Гипотенуза "+c+", бір катет "+a+". Екінші катетті табыңыз."},ans:b,solution:"b = √("+c+"² − "+a+"²) = "+b};
 return{q:{ru:"Стороны прямоугольного треугольника: катеты "+a+", "+b+". Найдите его периметр.",kk:"Тікбұрышты үшбұрыштың катеттері "+a+", "+b+". Периметрін табыңыз."},ans:a+b+c,solution:"c = "+c+"; P = "+a+" + "+b+" + "+c+" = "+(a+b+c)}
}
function geometric(level,r){
 const a=nonzero(r,-6,6),q=integer(r,2,4),n=integer(r,3,6);
 if(level==="A")return{q:{ru:"В геометрической прогрессии b₁ = "+a+", q = "+q+". Найдите b₃.",kk:"Геометриялық прогрессияда b₁ = "+a+", q = "+q+". b₃ табыңыз."},ans:a*q*q,solution:"b₃ = "+a+" · "+q+"² = "+(a*q*q)};
 if(level==="B")return{q:{ru:"В геометрической прогрессии b₁ = "+a+", q = "+q+". Найдите b"+n+".",kk:"Геометриялық прогрессияда b₁ = "+a+", q = "+q+". b"+n+" табыңыз."},ans:a*q**(n-1),solution:"b"+n+" = "+a+" · "+q+"^"+(n-1)+" = "+(a*q**(n-1))};
 const last=a*q**(n-1);return{q:{ru:"В геометрической прогрессии b₁ = "+a+", q = "+q+". Найдите сумму первых "+n+" членов.",kk:"Геометриялық прогрессияда b₁ = "+a+", q = "+q+". Алғашқы "+n+" мүшесінің қосындысын табыңыз."},ans:a*(q**n-1)/(q-1),solution:"S"+n+" = "+a+" · ("+q+"^"+n+" − 1)/("+q+" − 1) = "+(a*(q**n-1)/(q-1))}
}
function derivative(level,r){
 const a=nonzero(r,-5,5),x=integer(r,-4,4),b=integer(r,-8,8),c=integer(r,-8,8),ans=2*a*x+b;
 if(level==="A")return{q:{ru:"Найдите f'("+x+"), если f(x) = "+a+"x² "+signed(b)+"x "+signed(c)+".",kk:"f(x) = "+a+"x² "+signed(b)+"x "+signed(c)+" болса, f'("+x+") табыңыз."},ans,solution:"f'(x) = "+(2*a)+"x "+signed(b)+"; f'("+x+") = "+ans};
 if(level==="B")return{q:{ru:"Найдите угловой коэффициент касательной к y = "+a+"x² "+signed(b)+"x "+signed(c)+" при x = "+x+".",kk:"y = "+a+"x² "+signed(b)+"x "+signed(c)+" графигіне x = "+x+" нүктесіндегі жанаманың көлбеулік коэффициентін табыңыз."},ans,solution:"k = y'("+x+") = "+ans};
 const k=integer(r,-5,5),B=-2*a*k;
 return{q:{ru:"Найдите x, при котором производная f(x) = "+a+"x² "+signed(B)+"x "+signed(c)+" равна нулю.",kk:"f(x) = "+a+"x² "+signed(B)+"x "+signed(c)+" функциясының туындысы нөлге тең болатын x табыңыз."},ans:k,solution:"2·"+a+"x "+signed(B)+" = 0; x = "+k}
}
function logarithm(level,r){
 const base=integer(r,2,5),m=integer(r,1,4),n=integer(r,1,3);
 if(level==="A")return{q:{ru:"Вычислите log_"+base+"("+base+"^"+m+").",kk:"log_"+base+"("+base+"^"+m+") есептеңіз."},ans:m,solution:"log_"+base+"("+base+"^"+m+") = "+m};
 if(level==="B")return{q:{ru:"Решите уравнение "+base+"^x = "+base**m+". Найдите x.",kk:base+"^x = "+base**m+" теңдеуінен x табыңыз."},ans:m,solution:"x = log_"+base+"("+base**m+") = "+m};
 return{q:{ru:"Вычислите log_"+base+"("+base**m+" · "+base**n+").",kk:"log_"+base+"("+base**m+" · "+base**n+") есептеңіз."},ans:m+n,solution:"log_"+base+"("+base+"^"+m+" · "+base+"^"+n+") = "+m+" + "+n+" = "+(m+n)}
}
const generators={progression,quadratic,rational,percent,linear,roots,trig,fractions,proportion,powers,pythagoras,geometric,derivative,logarithm}
window.MAcademyMath={generators,fmt,rngFor,integer,nonzero,topicIds:Object.keys(generators),generate:function(topic,level,count,variant){if(!Object.hasOwn(generators,topic))throw Error("Unknown topic");if(!["all","A","B","C"].includes(level))throw Error("Unknown level");count=Math.min(20,Math.max(1,Number(count)||6));variant=Math.min(99999,Math.max(1,Number(variant)||1));const seed=([...topic].reduce((s,ch)=>Math.imul(31,s)+ch.charCodeAt(0),0)^Math.imul(variant,7919)^({all:59,A:101,B:503,C:907}[level]))>>>0;const rand=rngFor(seed);return Array.from({length:count},(_,i)=>{const lvl=level==="all"?["A","B","C"][i%3]:level;return{...generators[topic](lvl,rand),level:lvl}})}};
})();