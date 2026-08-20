import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Percent,
  Tag,
  TriangleAlert,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { buttonClass } from '@/components/Button';
import { routes } from '@/config/routes';
import type { DashboardOverviewResponse } from '@/types/dashboard';

type KpiProps = {
  label: string;
  value: string | number;
  sub: string;
  mobileSub: string;
  Icon: LucideIcon;
  href: string;
};

function Kpi({ label, value, sub, mobileSub, Icon, href }: KpiProps) {
  return (
    <Link className="card kpi interactive" href={href}>
      <small>{label}</small>
      <strong>{value}</strong>
      <p title={sub}>
        <span className="desktop-copy">{sub}</span>
        <span className="mobile-copy">{mobileSub}</span>
      </p>
      <span>
        <Icon />
      </span>
    </Link>
  );
}

export function Dashboard({ data }: { data: DashboardOverviewResponse }) {
  return (
    <>
      <section className="title">
        <h1>Visão Geral</h1>
        <p>Saúde da sua precificação, custos e margens.</p>
      </section>

      <section className="kpis kpi-slider">
        <Kpi
          label="Margem média projetada"
          value={`${data.averageMargin}%`}
          sub="2,8 pontos percentuais acima da meta de 30%"
          mobileSub="+2,8 p.p. vs. meta de 30%"
          Icon={Percent}
          href={routes.pricing}
        />
        <Kpi
          label="Produtos para revisar"
          value={data.reviewCount}
          sub={`${data.criticalCount} críticos · ${data.warningCount} em atenção`}
          mobileSub={`${data.criticalCount} críticos · ${data.warningCount} em atenção`}
          Icon={TriangleAlert}
          href={routes.productsReview}
        />
        <Kpi
          label="Reajustes recomendados"
          value={data.recommendedCount}
          sub="preços com recomendação ativa"
          mobileSub={`${data.recommendedCount} recomendações ativas`}
          Icon={TrendingUp}
          href={routes.pricingRecommendations}
        />
      </section>

      <section className="primary-grid">
        <article className="card insight">
          <h2>
            INSIGHT <b>NEQTA</b>
          </h2>

          <div className="insight-body">
            <Image
              className="insight-mascot"
              src="/brand/mascote.png"
              width={190}
              height={238}
              alt="Mascote NEQTA apresentando uma recomendação de preço"
              priority
            />

            <div>
              <h3>
                <span className="desktop-copy">
                  <b>3 produtos</b> exigem atenção prioritária.
                </span>
                <span className="mobile-copy">
                  <b>3 produtos</b> exigem atenção.
                </span>
              </h3>

              <p>
                X-Bacon caiu para <em>18,6%</em> de margem projetada.
              </p>
              <p>
                Impacto: <em>−4,2 p.p.</em>
              </p>

              <div className="prices">
                <span>
                  R$29,90
                  <small>Preço atual</small>
                </span>
                <ArrowRight />
                <span>
                  R$32,90
                  <small>Preço sugerido</small>
                </span>
              </div>

              <Link
                className={buttonClass('primary')}
                href={routes.pricingProduct('x-bacon')}
              >
                Simular ajuste
                <ArrowRight />
              </Link>
            </div>
          </div>
        </article>

        <Costs />
      </section>

      <section className="lower-grid">
        <article className="card actions">
          <h2>Próximas ações</h2>

          <Link href={routes.suppliers('carne-bovina')}>
            <CheckCircle2 />
            Comparar fornecedores de carne bovina
            <ArrowRight />
          </Link>

          <Link href={routes.product('batata-premium')}>
            <CheckCircle2 />
            Revisar porção da Batata Premium
            <ArrowRight />
          </Link>

          <Link href={routes.productsReview}>
            <CheckCircle2 />
            Revisar preços dos produtos afetados
            <ArrowRight />
          </Link>

          <footer className="card-footer">
            <Link className={`${buttonClass('ghost')} action-row`} href={routes.productsReview}>
              <span className="action-row-label">Ver todas</span>
              <span className="action-row-icon"><ArrowRight /></span>
            </Link>
          </footer>
        </article>

        <article className="card promo">
          <Tag />
          <div>
            <h2>3 oportunidades de promoção</h2>
            <p>Até 15% OFF sem ultrapassar sua margem mínima.</p>
            <Link className={`${buttonClass('secondary')} action-row`} href={routes.promotions}>
              <span className="action-row-label">Ver promoções</span>
              <span className="action-row-icon"><ArrowRight /></span>
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}

function Costs() {
  const rows = [
    ['carne-bovina', 'Carne bovina', '7 produtos afetados', '+14,3%'],
    ['mucarela', 'Muçarela', '12 produtos afetados', '+8,1%'],
    ['embalagem-delivery', 'Embalagem delivery', '18 produtos afetados', '+6,4%'],
  ];

  return (
    <article className="card costs">
      <h2>Custos que pressionam preços</h2>

      {rows.map((row, index) => (
        <Link href={routes.costIngredient(row[0])} key={row[0]}>
          <TrendingUp className={index === 0 ? 'red' : index === 1 ? 'amber' : ''} />
          <span>
            {row[1]}
            <small>{row[2]}</small>
          </span>
          <b>{row[3]}</b>
          <ArrowRight />
        </Link>
      ))}
    </article>
  );
}
