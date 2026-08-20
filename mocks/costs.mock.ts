import type { CostItem, Purchase, StructureCost, Supplier, TeamCost } from '@/types/cost';

export const suppliers: Supplier[] = [
  { id: 'alfa', name: 'Frigorífico Alfa' }, { id: 'sul', name: 'Laticínios Sul' },
  { id: 'central', name: 'Padaria Central' }, { id: 'packfood', name: 'PackFood' },
];

const now = '2026-08-17T12:00:00.000Z';
const productCatalog = [
  {productId:'x-bacon',name:'X-Bacon',category:'Lanches',margin:18.6},
  {productId:'cheeseburger',name:'Cheeseburger',category:'Lanches',margin:24.8},
  {productId:'combo-familia',name:'Combo Família',category:'Combos',margin:27.2},
  {productId:'x-salada',name:'X-Salada',category:'Lanches',margin:31.4},
  {productId:'burger-duplo',name:'Burger Duplo',category:'Lanches',margin:22.9},
  {productId:'smash-bacon',name:'Smash Bacon',category:'Lanches',margin:25.1},
  {productId:'combo-casal',name:'Combo Casal',category:'Combos',margin:29.7},
  {productId:'batata-premium',name:'Batata Premium',category:'Acompanhamentos',margin:36.5},
  {productId:'milkshake-chocolate',name:'Milk-shake de Chocolate',category:'Bebidas',margin:33.8},
  {productId:'combo-individual',name:'Combo Individual',category:'Combos',margin:28.3},
  {productId:'x-egg',name:'X-Egg',category:'Lanches',margin:26.7},
  {productId:'burger-salada',name:'Burger Salada',category:'Lanches',margin:30.2},
];
const relations=(names:string[])=>productCatalog.filter(product=>names.includes(product.name));
export const costItems: CostItem[] = [
  { id:'carne',name:'Carne bovina',type:'ingredient',category:'Carnes',supplierId:'alfa',purchasePrice:188,purchaseQuantity:5,purchaseUnit:'kg',baseUnitCost:37.6,previousUnitCost:32.9,usedBy:['X-Bacon','Cheeseburger','Combo Família','X-Salada','Burger Duplo','Smash Bacon','Combo Casal'],affectedProducts:relations(['X-Bacon','Cheeseburger','Combo Família','X-Salada','Burger Duplo','Smash Bacon','Combo Casal']),history:[{id:'h1',date:'2026-08-17',price:188,unitCost:37.6},{id:'h2',date:'2026-08-02',price:174.5,unitCost:34.9},{id:'h3',date:'2026-07-10',price:164.5,unitCost:32.9}],createdAt:now,updatedAt:now },
  { id:'mucarela',name:'Muçarela',type:'ingredient',category:'Laticínios',supplierId:'sul',purchasePrice:171.6,purchaseQuantity:4,purchaseUnit:'kg',baseUnitCost:42.9,previousUnitCost:39.69,usedBy:productCatalog.map(product=>product.name),affectedProducts:productCatalog,history:[{id:'h4',date:'2026-08-17',price:171.6,unitCost:42.9}],createdAt:now,updatedAt:now },
  { id:'pao',name:'Pão brioche',type:'ingredient',category:'Pães',supplierId:'central',purchasePrice:37,purchaseQuantity:20,purchaseUnit:'un',baseUnitCost:1.85,previousUnitCost:1.81,usedBy:['X-Bacon','Cheeseburger','X-Salada','Burger Duplo','Smash Bacon'],affectedProducts:relations(['X-Bacon','Cheeseburger','X-Salada','Burger Duplo','Smash Bacon']),history:[{id:'h5',date:'2026-08-12',price:37,unitCost:1.85}],createdAt:now,updatedAt:now },
  { id:'caixa',name:'Caixa burger',type:'packaging',category:'Embalagens',supplierId:'packfood',purchasePrice:120,purchaseQuantity:100,purchaseUnit:'un',baseUnitCost:1.2,previousUnitCost:1.128,usedBy:['X-Bacon','Cheeseburger','Combo Família','X-Salada','Burger Duplo','Smash Bacon','Combo Casal','Combo Individual'],affectedProducts:relations(['X-Bacon','Cheeseburger','Combo Família','X-Salada','Burger Duplo','Smash Bacon','Combo Casal','Combo Individual']),history:[{id:'h6',date:'2026-08-15',price:120,unitCost:1.2}],createdAt:now,updatedAt:now },
  { id:'pote',name:'Pote 500 ml',type:'packaging',category:'Embalagens',supplierId:'packfood',purchasePrice:165,purchaseQuantity:100,purchaseUnit:'un',baseUnitCost:1.65,previousUnitCost:1.65,usedBy:['Batata Premium','Milk-shake de Chocolate','Combo Família'],affectedProducts:relations(['Batata Premium','Milk-shake de Chocolate','Combo Família']),history:[],createdAt:now,updatedAt:now },
];

export const purchases: Purchase[] = costItems.slice(0,4).map((item,index)=>({id:`p${index}`,itemId:item.id,supplierId:item.supplierId,date:['2026-08-17','2026-08-17','2026-08-12','2026-08-15'][index],quantity:item.purchaseQuantity,unit:item.purchaseUnit,price:item.purchasePrice}));
export const structureCosts: StructureCost[] = [{id:'aluguel',description:'Aluguel',category:'Aluguel',monthlyValue:4000,recurrence:'monthly'},{id:'energia',description:'Energia',category:'Energia',monthlyValue:1250,recurrence:'monthly'},{id:'internet',description:'Internet',category:'Internet',monthlyValue:180,recurrence:'monthly'}];
export const teamCosts: TeamCost[] = [{id:'cozinheiro',role:'Cozinheiro',salary:2400,charges:800,benefits:500,otherCosts:0},{id:'atendente',role:'Atendente',salary:1800,charges:600,benefits:450,otherCosts:0}];
