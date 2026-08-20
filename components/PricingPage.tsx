'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { buttonClass } from '@/components/Button';
import { commercialRound, formatPercent, marginForChannel, money, parseBRL, recommendedPriceForChannel } from '@/lib/financial';
import { routes } from '@/config/routes';
import { defaultSettings, loadSettings } from '@/lib/settings';
import type { NeqtaSettings } from '@/types/settings';
import type { Product, ProductStatus } from '@/types/product';
import { productsService } from '@/services/products.service';

type Filter='all'|'healthy'|'warning'|'critical'|'recommended';
const labels:Record<ProductStatus,string>={healthy:'Saudável',warning:'Atenção',critical:'Crítico',recipe:'Receita-base'};
const filters:Array<[Filter,string]>=[['all','Todos'],['healthy','Saudáveis'],['warning','Atenção'],['critical','Críticos'],['recommended','Com recomendação']];

export function PricingPage({initialProducts,initialProductId}:{initialProducts:Product[];initialProductId?:string}){
  const base=initialProducts.filter(product=>product.status!=='recipe');
  const [products,setProducts]=useState(base);
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [selected,setSelected]=useState<Product|null>(base.find(product=>product.id===initialProductId)??null);
  const [picker,setPicker]=useState(false);
  const [action,setAction]=useState<string|null>(null);
  const [toast,setToast]=useState('');
  const [settings,setSettings]=useState<NeqtaSettings>(defaultSettings);
  useEffect(()=>{void productsService.list().then(stored=>setProducts(stored.filter(product=>product.status!=='recipe')))},[]);
  useEffect(()=>{setSettings(loadSettings());const sync=(event:Event)=>setSettings((event as CustomEvent<NeqtaSettings>).detail);window.addEventListener('neqta-settings-updated',sync);return()=>window.removeEventListener('neqta-settings-updated',sync)},[]);
  const visible=useMemo(()=>products.filter(product=>product.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).filter(product=>filter==='all'||filter==='recommended'&&product.recommendedPrice>product.currentPrice||product.status===filter),[products,query,filter]);
  const counts={recommended:products.filter(p=>p.recommendedPrice>p.currentPrice).length,critical:products.filter(p=>p.status==='critical').length,warning:products.filter(p=>p.status==='warning').length};
  const openSimulation=(product:Product)=>setSelected(product);
  const persist=(updated:Product)=>{setProducts(products.map(product=>product.id===updated.id?updated:product));void productsService.save(updated);setSelected(null);setToast('Preço atualizado com sucesso.');window.setTimeout(()=>setToast(''),3000)};
  const applyRecommendation=(product:Product)=>{if(product.recommendedPrice<=product.currentPrice)return;if(window.confirm(`Aplicar ${money(product.recommendedPrice)} ao produto ${product.name}?`))persist({...product,currentPrice:product.recommendedPrice,projectedMargin:marginForChannel(product.recommendedPrice,product.variableCost)??0,status:statusFor(marginForChannel(product.recommendedPrice,product.variableCost)??0,product.targetMargin)})};
  return <section className="pricing-page">
    <header className="pricing-heading"><div><h1>Precificação</h1><p>Defina preços mais seguros para seus produtos.</p></div><button className={buttonClass('primary')} onClick={()=>setPicker(true)} disabled={!products.length}><Plus/>Simular preço</button></header>
    {products.length===0?<Empty title="Nenhum produto para precificar." text="Cadastre seus produtos e suas composições para começar a calcular preços." href={routes.products} action="Cadastrar produto"/>:<>
      <section className="card pricing-xray"><div><h2>Raio-X da Precificação</h2><p>Veja rapidamente quais preços precisam da sua atenção.</p></div><div><button onClick={()=>setFilter('recommended')}><b>{counts.recommended}</b><span>Reajustes recomendados</span></button><button onClick={()=>setFilter('critical')}><b className="danger">{counts.critical}</b><span>Produtos críticos</span></button><button onClick={()=>setFilter('warning')}><b className="warning">{counts.warning}</b><span>Em atenção</span></button></div></section>
      <section className="pricing-toolbar"><label className="product-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar produto..."/></label><div className="filter-scroll">{filters.map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div></section>
      {visible.length===0?<Empty title="Nenhum produto encontrado." text="Revise a busca ou os filtros aplicados." action="Limpar filtros" onClick={()=>{setQuery('');setFilter('all')}}/>:<><PricingTable products={visible} open={openSimulation} action={action} setAction={setAction} apply={applyRecommendation}/><PricingCards products={visible} open={openSimulation}/></>}
    </>}
    {picker&&<ProductPicker products={products} close={()=>setPicker(false)} choose={product=>{setPicker(false);setSelected(product)}}/>}
    {selected&&<PricingDrawer product={selected} settings={settings} close={()=>setSelected(null)} apply={persist}/>} 
    {toast&&<div className="app-toast"><span><Check/>{toast}</span><button onClick={()=>setToast('')} aria-label="Fechar"><X/></button></div>}
  </section>;
}

function ProductPicker({products,close,choose}:{products:Product[];close:()=>void;choose:(product:Product)=>void}){
  const [query,setQuery]=useState('');
  const rank:Record<ProductStatus,number>={critical:0,warning:1,healthy:2,recipe:3};
  const visible=products.filter(product=>product.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a,b)=>rank[a.status]-rank[b.status]||a.name.localeCompare(b.name,'pt-BR'));
  return createPortal(<div className="product-overlay pricing-picker-overlay" onMouseDown={event=>event.target===event.currentTarget&&close()}><section className="product-drawer pricing-picker" role="dialog" aria-modal="true" aria-label="Escolher produto para simular"><header><div><h2>Simular preço</h2><p>Escolha um produto para iniciar a simulação.</p></div><button onClick={close} aria-label="Fechar"><X/></button></header><div className="product-drawer-content"><label className="product-search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar produto..." autoFocus/></label><div className="pricing-picker-list">{visible.map(product=><button key={product.id} onClick={()=>choose(product)}><span><b>{product.name}</b><small>{product.category}</small></span><span><small>Preço atual</small><b>{money(product.currentPrice)}</b></span><span><small>Margem projetada</small><b>{formatPercent(product.projectedMargin)}</b></span><span className="picker-status"><Status status={product.status}/>{product.recommendedPrice>product.currentPrice&&<small>Recomendado {money(product.recommendedPrice)}</small>}</span><ArrowRight/></button>)}</div></div></section></div>,document.body);
}

function PricingTable({products,open,action,setAction,apply}:{products:Product[];open:(p:Product)=>void;action:string|null;setAction:(id:string|null)=>void;apply:(p:Product)=>void}){return <section className="card pricing-table-wrap"><table className="pricing-table"><thead><tr><th>Produto</th><th>Custo</th><th>Preço atual</th><th>Margem projetada</th><th>Preço recomendado</th><th>Status</th><th>Ações</th></tr></thead><tbody>{products.map(product=><tr key={product.id} onClick={()=>open(product)}><td><b>{product.name}</b><small>{product.category}</small></td><td>{money(product.variableCost)}</td><td>{money(product.currentPrice)}</td><td><b>{formatPercent(product.projectedMargin)}</b></td><td>{product.recommendedPrice>product.currentPrice?<strong className="pricing-recommended">{money(product.recommendedPrice)}</strong>:<span className="muted-value">—</span>}</td><td><Status status={product.status}/></td><td className="pricing-actions" onClick={event=>event.stopPropagation()}><button aria-label={`Ações de ${product.name}`} onClick={()=>setAction(action===product.id?null:product.id)}><MoreHorizontal/></button>{action===product.id&&<div className="action-menu"><button onClick={()=>open(product)}>Ver análise</button><button onClick={()=>open(product)}>Simular preço</button>{product.recommendedPrice>product.currentPrice&&<button onClick={()=>apply(product)}>Aplicar recomendação</button>}<Link href={`${routes.products}?produto=${product.id}`}>Editar produto</Link></div>}</td></tr>)}</tbody></table></section>}
function PricingCards({products,open}:{products:Product[];open:(p:Product)=>void}){return <section className="pricing-cards">{products.map(product=><article className="card pricing-card" key={product.id}><header><div><h2>{product.name}</h2><p>{product.category}</p></div><Status status={product.status}/></header><div className="pricing-card-grid"><span>Custo<b>{money(product.variableCost)}</b></span><span>Preço atual<b>{money(product.currentPrice)}</b></span><span>Margem projetada<b>{formatPercent(product.projectedMargin)}</b></span><span className={product.recommendedPrice>product.currentPrice?'recommended':''}>Preço recomendado<b>{product.recommendedPrice>product.currentPrice?money(product.recommendedPrice):'—'}</b></span></div><button className="action-row" onClick={()=>open(product)}><span>Simular preço</span><ArrowRight/></button></article>)}</section>}
function Status({status}:{status:ProductStatus}){return <span className={`status-badge ${status}`}>{labels[status]}</span>}
function Empty({title,text,href,action,onClick}:{title:string;text:string;href?:string;action:string;onClick?:()=>void}){return <section className="card pricing-empty"><h2>{title}</h2><p>{text}</p>{href?<Link className={buttonClass('primary')} href={href}>{action}</Link>:<button className={buttonClass('secondary')} onClick={onClick}>{action}</button>}</section>}

function PricingDrawer({product,settings,close,apply}:{product:Product;settings:NeqtaSettings;close:()=>void;apply:(p:Product)=>void}){
  const target=settings.financial.targetMargin||product.targetMargin||30;
  const embeddedFees=product.currentPrice>0?Math.max(0,100-(product.variableCost/product.currentPrice*100)-product.projectedMargin):0;
  const mathematical=recommendedPriceForChannel(product.variableCost,target,embeddedFees);
  const targetPrice=commercialRound(mathematical);
  const recommended=Math.max(targetPrice,product.recommendedPrice>product.currentPrice?product.recommendedPrice:0);
  const [price,setPrice]=useState(recommended);
  const margin=marginForChannel(price,product.variableCost,embeddedFees)??0;
  const contribution=Math.max(0,price-product.variableCost-(price*embeddedFees/100));
  const changed=Math.abs(price-product.currentPrice)>.001;
  const status=statusFor(margin,target);
  const defaultPayment=settings.payments.find(payment=>payment.active);
  const channelRows=settings.channels.filter(channel=>channel.active).map(channel=>{const paymentFee=channel.processesPayment?0:(defaultPayment?.percentageFee??0);const fixedFee=channel.fixedFee+(channel.processesPayment?0:(defaultPayment?.fixedFee??0));const totalFees=embeddedFees+channel.percentageFee+paymentFee+settings.financial.salesTax;const raw=recommendedPriceForChannel(product.variableCost,target,totalFees,fixedFee);const suggested=commercialRound(raw);return{id:channel.id,name:channel.name,fee:channel.percentageFee,suggested,margin:marginForChannel(suggested,product.variableCost,totalFees,fixedFee)??0}});
  return createPortal(<div className="product-overlay pricing-overlay" onMouseDown={event=>event.target===event.currentTarget&&close()}><section className="product-drawer pricing-drawer" role="dialog" aria-modal="true" aria-label="Simular preço"><header><div><h2>Simular preço</h2><p>{product.name} · {product.category}</p></div><button onClick={close} aria-label="Fechar"><X/></button></header><div className="product-drawer-content pricing-drawer-content">
    <section className="pricing-current"><span>Custo variável<b>{money(product.variableCost)}</b></span><span>Preço atual<b>{money(product.currentPrice)}</b></span><span>Margem projetada<b>{formatPercent(product.projectedMargin)}</b></span><span>Meta da empresa<b>{formatPercent(target)}</b></span></section>
    <section className="pricing-reference"><h3>Preços de referência</h3><div><span>Preço mínimo<b>—</b><small>Respeita a margem mínima configurada.</small></span><span>Preço para meta<b>{money(targetPrice)}</b><small>Necessário para alcançar a meta da empresa.</small></span><span className="featured">Preço recomendado<b>{money(recommended)}</b><small>Sugestão final da NEQTA.</small></span></div><p className="pricing-reference-note"><b>Por que este preço?</b> Considera custos, meta de margem, taxas dos canais e arredondamento comercial.</p><Link href={routes.settings}>Complete suas informações financeiras · Ir para Configurações</Link></section>
    <section className="pricing-simulator"><h3>Simular novo preço</h3><label>Preço-base simulado<input aria-label="Preço-base simulado" value={price?money(price):''} inputMode="numeric" onChange={event=>setPrice(parseBRL(event.target.value))}/><small>Usado como referência para calcular os preços recomendados em cada canal.</small></label><div className="simulation-result"><div className="simulation-margin"><span>Nova margem projetada</span><strong>{formatPercent(margin)}</strong><Status status={status}/></div><p className={margin-product.projectedMargin>=0?'success-text':'danger-text'}>{margin-product.projectedMargin>=0?'+':''}{(margin-product.projectedMargin).toFixed(1).replace('.',',')} p.p. em relação ao preço atual</p><span className="simulation-contribution">Contribuição estimada por unidade<b>{money(contribution)}</b></span></div><div className="pricing-comparison"><span>Atual <b>{money(product.currentPrice)}</b></span><ArrowRight/><span>Simulado <b>{money(price)}</b></span></div></section>
    <section className="pricing-channels"><h3>Preços recomendados por canal</h3><p>Ajustados pelas taxas configuradas em cada canal.</p><div>{channelRows.map(channel=><article key={channel.id}><span><span className="channel-title"><b>{channel.name}</b>{channel.id==='store'&&<em>Principal</em>}</span><small>{channel.fee?`Taxas ${channel.fee}%`:'Sem taxa'}</small></span><span><small>Preço recomendado</small><b>{money(channel.suggested)}</b></span><span><small>Margem projetada</small><b>{formatPercent(channel.margin)}</b></span></article>)}</div></section>
  </div><footer className="pricing-drawer-footer"><span>{money(product.currentPrice)} <ArrowRight/> <b>{money(price)}</b></span><button className={buttonClass('primary')} disabled={!changed||price<=0} onClick={()=>apply({...product,currentPrice:price,projectedMargin:margin,recommendedPrice:price>=recommended?price:recommended,status})}>Atualizar preço na NEQTA</button></footer></section></div>,document.body);
}
function statusFor(margin:number,target:number):ProductStatus{return margin<target-8?'critical':margin<target?'warning':'healthy'}
