export const currency=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});export const percent=(value:number)=>`${value.toLocaleString('pt-BR',{minimumFractionDigits:1})}%`;
