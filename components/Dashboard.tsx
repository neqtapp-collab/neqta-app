'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Percent, Tag, TriangleAlert, TrendingUp, type LucideIcon } from 'lucide-react';
import { buttonClass } from '@/components/Button';
import { money } from '@/lib/financial';
import { routes } from '@/config/routes';
import type { DashboardOverviewResponse } from '@/types/dashboard';

type KpiProps={label:string;value:string|number;sub:string;Icon:LucideIcon;href:string};
function Kpi({label,value,sub,Icon,href}:KpiProps){return <Link className="card kpi interactive" href={href}><small>{label}</small><strong>{value}</strong><p>{sub}</p><span><Icon/></span></Link>}

export function Dashboard({data}:{data:DashboardOverviewResponse}){
  const marginDifference=data.averageMargin-data.targetMargin;
  const priority=data.priorityProduct;
  return <><section className="title"><h1>Visão Geral</h1><p>Saúde da sua precificação, custos e margens.</p></section>
    <section className="kpis kpi-slider">
      <Kpi label="Margem média projetada" value={`${data.averageMargin.toFixed(1).replace('.',',')}%`} sub={`${Math.abs(marginDifference).toFixed(1).replace('.',',')} p.p. ${marginDifference>=0?'acima':'abaixo'} da meta de ${data.targetMargin}%`} Icon={Percent} href={routes.pricing}/>
      <Kpi label="Produtos para revisar" value={data.reviewCount} sub={`${data.criticalCount} críticos · ${data.warningCount} em atenção`} Icon={TriangleAlert} href={routes.productsReview}/>
      <Kpi label="Reajustes recomendados" value={data.recommendedCount} sub="preços com recomendação ativa" Icon={TrendingUp} href={routes.pricingRecommendations}/>
    </section>
    <section className="primary-grid">
      <article className="card insight"><h2>INSIGHT <b>NEQTA</b></h2>{priority?<div className="insight-body"><div><h3><b>{data.reviewCount} {data.reviewCount===1?'produto exige':'produtos exigem'}</b> atenção.</h3><p>{priority.recommendedPrice>0?<>{priority.name} está com <em>{priority.margin.toFixed(1).replace('.',',')}%</em> de margem projetada.</>:<>Complete os custos de {priority.name} para calcular uma margem confiável.</>}</p>{priority.recommendedPrice>0?<div className="prices"><span>{money(priority.currentPrice)}<small>Preço atual</small></span><ArrowRight/><span>{money(priority.recommendedPrice)}<small>Preço sugerido</small></span></div>:null}<Link className={buttonClass('primary')} href={priority.recommendedPrice>0?routes.pricingProduct(priority.id):routes.product(priority.id)}>{priority.recommendedPrice>0?'Simular ajuste':'Completar custos'}<ArrowRight/></Link></div></div>:<div className="dashboard-empty"><h3>Seus produtos estão dentro das margens configuradas.</h3><p>A NEQTA continuará acompanhando custos e preços.</p></div>}</article>
      <Costs rows={data.pressuringCosts}/>
    </section>
    <section className="lower-grid">
      <article className="card actions"><h2>Próximas ações</h2>{priority?<Link href={priority.recommendedPrice>0?routes.pricingProduct(priority.id):routes.product(priority.id)}><CheckCircle2/>{priority.recommendedPrice>0?'Revisar preço de':'Completar custos de'} {priority.name}<ArrowRight/></Link>:<p className="dashboard-empty-copy">Nenhuma revisão prioritária no momento.</p>}{data.pressuringCosts.map(cost=><Link href={routes.costIngredient(cost.id)} key={cost.id}><CheckCircle2/>Revisar impacto de {cost.name}<ArrowRight/></Link>)}</article>
      <article className="card promo"><Tag/><div><h2>{data.promotionOpportunityCount} {data.promotionOpportunityCount===1?'oportunidade':'oportunidades'} de promoção</h2><p>{data.promotionOpportunityCount? `Até ${data.maximumSafeDiscount}% OFF sem ultrapassar sua margem mínima.`:'Nenhuma oportunidade segura no momento.'}</p><Link className={`${buttonClass('secondary')} action-row`} href={routes.promotions}><span className="action-row-label">Ver promoções</span><span className="action-row-icon"><ArrowRight/></span></Link></div></article>
    </section></>
}

function Costs({rows}:{rows:DashboardOverviewResponse['pressuringCosts']}){return <article className="card costs"><h2>Custos que pressionam preços</h2>{rows.length?rows.map((row,index)=><Link href={routes.costIngredient(row.id)} key={row.id}><TrendingUp className={index===0?'red':index===1?'amber':''}/><span>{row.name}<small>{row.affectedProducts} {row.affectedProducts===1?'produto afetado':'produtos afetados'}</small></span><b>+{row.variation.toFixed(1).replace('.',',')}%</b><ArrowRight/></Link>):<p className="dashboard-empty-copy">Nenhum aumento de custo impactando produtos.</p>}</article>}
