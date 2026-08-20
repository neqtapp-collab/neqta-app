'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, Check, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { buttonClass } from '@/components/Button';
import { CustomSelect } from '@/components/CustomSelect';
import { formatPercent, marginForChannel, money, parseBRL, parsePercent } from '@/lib/financial';
import { todayISO } from '@/lib/date';
import { productsService } from '@/services/products.service';
import { routes } from '@/config/routes';
import { defaultSettings, loadSettings } from '@/lib/settings';
import type { NeqtaSettings } from '@/types/settings';
import type { Product } from '@/types/product';
import type { Promotion, PromotionSource, PromotionStatus, PromotionType } from '@/types/promotion';

type Filter = 'all' | 'neqta' | 'manual' | 'active' | 'ended';
type PromotionRow = Promotion & { product: Product; maxDiscount: number };

const storageKey = 'neqta-promotions';
const channels = [
  { id: 'store', name: 'Loja', fee: 0 },
  { id: 'ifood', name: 'iFood', fee: 23 },
  { id: '99', name: '99', fee: 14 },
];
const statusLabels: Record<PromotionStatus, string> = {
  safe: 'Segura',
  warning: 'Atenção',
  unsafe: 'Não recomendada',
  active: 'Ativa',
  ended: 'Encerrada',
};
const typeLabels: Record<PromotionType, string> = {
  percentage: 'Desconto percentual',
  fixed: 'Desconto em R$',
  price: 'Preço promocional',
  take2: 'Leve 2',
  combo: 'Combo',
};

function embeddedFees(product: Product) {
  return product.currentPrice > 0
    ? Math.max(0, 100 - (product.variableCost / product.currentPrice) * 100 - product.projectedMargin)
    : 0;
}

function safeLimit(product: Product, minimumMargin = 25) {
  const divisor = 1 - minimumMargin / 100 - embeddedFees(product) / 100;
  if (product.currentPrice <= 0 || divisor <= 0) return { minimumPrice: product.currentPrice, maxDiscount: 0 };
  const minimumPrice = product.variableCost / divisor;
  return { minimumPrice, maxDiscount: Math.max(0, (1 - minimumPrice / product.currentPrice) * 100) };
}

function commercialDiscount(maximum: number) {
  return [20, 15, 10, 5].find((value) => value <= maximum) ?? 0;
}

function statusFor(margin: number, minimumMargin = 25): PromotionStatus {
  if (margin < minimumMargin) return 'unsafe';
  if (margin < minimumMargin + 3) return 'warning';
  return 'safe';
}

function sourceLabel(source: PromotionSource) {
  return source === 'neqta' ? 'NEQTA' : 'Manual';
}

function evaluatePromotion(product: Product, promotion: Pick<Promotion, 'promotionalPrice'>, minimumMargin = 25) {
  const promotionalPrice = promotion.promotionalPrice;
  const margin = marginForChannel(promotionalPrice, product.variableCost, embeddedFees(product)) ?? 0;
  const contribution = promotionalPrice - product.variableCost - promotionalPrice * embeddedFees(product) / 100;
  const limit = safeLimit(product, minimumMargin);
  const equivalentDiscount = product.currentPrice > 0
    ? Math.max(0, (1 - promotionalPrice / product.currentPrice) * 100)
    : 0;
  const classification = statusFor(margin, minimumMargin);
  const valid = margin >= minimumMargin
    && contribution > 0
    && promotionalPrice > product.variableCost
    && classification !== 'unsafe'
    && equivalentDiscount <= limit.maxDiscount + 0.001;
  return { margin, contribution, classification, valid };
}

export function PromotionsPage({ initialProducts }: { initialProducts: Product[] }) {
  const [products,setProducts]=useState(initialProducts.filter((product) => product.status !== 'recipe'));
  const [saved, setSaved] = useState<Promotion[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<{ product: Product; promotion?: Promotion; source: PromotionSource } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [settings,setSettings]=useState<NeqtaSettings>(defaultSettings);

  useEffect(()=>{setSettings(loadSettings());const sync=(event:Event)=>setSettings((event as CustomEvent<NeqtaSettings>).detail);window.addEventListener('neqta-settings-updated',sync);return()=>window.removeEventListener('neqta-settings-updated',sync)},[]);
  useEffect(()=>{void productsService.list().then(rows=>setProducts(rows.filter(product=>product.status!=='recipe')));const sync=(event:Event)=>setProducts(((event as CustomEvent<Product[]>).detail??[]).filter(product=>product.status!=='recipe'));window.addEventListener('neqta-products-updated',sync);return()=>window.removeEventListener('neqta-products-updated',sync)},[]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as Promotion[];
      const corrected = stored.map((promotion) => {
        const product = products.find((item) => item.id === promotion.productId);
        if (!product) return promotion;
        const evaluation = evaluatePromotion(product, promotion, settings.financial.minimumMargin);
        return {
          ...promotion,
          marginAfterPromotion: evaluation.margin,
          status: promotion.status === 'ended'
            ? 'ended' as PromotionStatus
            : promotion.status === 'active' && evaluation.valid
              ? 'active' as PromotionStatus
              : evaluation.valid
                ? promotion.status
                : 'unsafe' as PromotionStatus,
        };
      });
      setSaved(corrected);
      if (JSON.stringify(corrected) !== JSON.stringify(stored)) {
        localStorage.setItem(storageKey, JSON.stringify(corrected));
      }
    } catch {}
  }, [products, settings.financial.minimumMargin]);

  const suggestions = useMemo(
    () => products.map((product) => {
      const limit = safeLimit(product, settings.financial.minimumMargin);
      const discount = commercialDiscount(limit.maxDiscount);
      const price = product.currentPrice * (1 - discount / 100);
      const margin = marginForChannel(price, product.variableCost, embeddedFees(product)) ?? 0;
      return {
        id: `neqta-${product.id}`,
        productId: product.id,
        type: 'percentage' as PromotionType,
        discountValue: discount,
        promotionalPrice: price,
        marginAfterPromotion: margin,
        channels: ['store'],
        source: 'neqta' as PromotionSource,
        status: discount ? statusFor(margin, settings.financial.minimumMargin) : 'unsafe' as PromotionStatus,
        createdAt: todayISO(),
        maxDiscount: limit.maxDiscount,
        product,
      };
    }),
    [products, settings.financial.minimumMargin],
  );

  const rows = useMemo<PromotionRow[]>(() => [
    ...suggestions,
    ...saved.map((promotion) => {
      const product = products.find((item) => item.id === promotion.productId)!;
      return { ...promotion, product, maxDiscount: product ? safeLimit(product, settings.financial.minimumMargin).maxDiscount : 0 };
    }).filter((row) => row.product),
  ].filter((row) => `${row.product.name} ${typeLabels[row.type]}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')))
    .filter((row) => filter === 'all'
      || (filter === 'neqta' && row.source === 'neqta')
      || (filter === 'manual' && row.source === 'manual')
      || (filter === 'active' && row.status === 'active')
      || (filter === 'ended' && row.status === 'ended')),
  [suggestions, saved, products, query, filter, settings.financial.minimumMargin]);

  const opportunities = suggestions.filter((row) => row.discountValue > 0);
  const maxAvailable = Math.round(Math.max(0, ...suggestions.map((row) => row.maxDiscount)));
  const withoutSpace = suggestions.filter((row) => row.discountValue === 0).length;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  }

  function persist(promotion: Promotion) {
    const product = products.find((item) => item.id === promotion.productId);
    if (!product || !evaluatePromotion(product, promotion, settings.financial.minimumMargin).valid) {
      notify('Esta promoção ultrapassa o limite seguro. Ajuste a oferta para continuar.');
      return;
    }
    const validated = { ...promotion, status: 'active' as PromotionStatus };
    const next = saved.some((row) => row.id === validated.id)
      ? saved.map((row) => row.id === validated.id ? validated : row)
      : [validated, ...saved];
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setEditing(null);
    notify('Promoção salva com sucesso.');
  }

  function update(promotion: Promotion) {
    const next = saved.map((row) => row.id === promotion.id ? promotion : row);
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setMenu(null);
  }

  function duplicate(promotion: Promotion) {
    const product = products.find((item) => item.id === promotion.productId);
    if (!product || !evaluatePromotion(product, promotion, settings.financial.minimumMargin).valid) {
      setMenu(null);
      notify('Esta promoção ultrapassa o limite seguro. Ajuste a oferta para continuar.');
      return;
    }
    const copy: Promotion = {
      id: `promo-${Date.now()}`,
      productId: promotion.productId,
      type: promotion.type,
      discountValue: promotion.discountValue,
      promotionalPrice: promotion.promotionalPrice,
      marginAfterPromotion: promotion.marginAfterPromotion,
      channels: [...promotion.channels],
      source: promotion.source,
      status: 'active',
      createdAt: new Date().toISOString(),
      startDate: promotion.startDate,
      endDate: promotion.endDate,
    };
    const next = [copy, ...saved];
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setMenu(null);
    notify('Promoção duplicada.');
  }

  function remove(promotion: Promotion) {
    if (!window.confirm('Excluir esta promoção?')) return;
    const next = saved.filter((row) => row.id !== promotion.id);
    setSaved(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setMenu(null);
  }

  return (
    <section className="promotions-page">
      <header className="promotions-heading">
        <div><h1>Promoções</h1><p>Crie ofertas sem comprometer sua margem.</p></div>
        <button className={buttonClass('primary')} onClick={() => setPicker(true)}><Plus />Nova promoção</button>
      </header>

      <section className="card promotions-xray">
        <div><h2>Oportunidades NEQTA</h2><p>Veja onde existe espaço seguro para criar ofertas.</p></div>
        <div>
          <button onClick={() => setFilter('neqta')}><b>{opportunities.length}</b><span>Oportunidades identificadas</span></button>
          <button onClick={() => setFilter('neqta')}><b>{maxAvailable}%</b><span>Maior desconto disponível</span></button>
          <button onClick={() => setFilter('neqta')}><b>{withoutSpace}</b><span>Sem espaço para promoção</span></button>
        </div>
      </section>

      <section className="promotions-toolbar">
        <label className="product-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto ou promoção..." /></label>
        <div className="filter-scroll">
          {([['all', 'Todas'], ['neqta', 'Sugeridas pela NEQTA'], ['manual', 'Criadas por mim'], ['active', 'Ativas'], ['ended', 'Encerradas']] as [Filter, string][]).map(([key, label]) => (
            <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </section>

      <PromotionTable rows={rows} simulate={(row) => setEditing({ product: row.product, promotion: row, source: row.source })} menu={menu} setMenu={setMenu} update={update} duplicate={duplicate} remove={remove} />
      <PromotionCards rows={rows} open={(row) => setEditing({ product: row.product, promotion: row, source: row.source })} />

      {picker && <PromotionPicker products={products} minimumMargin={settings.financial.minimumMargin} close={() => setPicker(false)} choose={(product) => { setPicker(false); setEditing({ product, source: 'manual' }); }} />}
      {editing && <PromotionDrawer product={editing.product} products={products} settings={settings} initial={editing.promotion} source={editing.source} close={() => setEditing(null)} save={persist} />}
      {toast && <div className="app-toast"><span><Check />{toast}</span><button onClick={() => setToast('')} aria-label="Fechar"><X /></button></div>}
    </section>
  );
}

function PromotionTable({ rows, simulate, menu, setMenu, update, duplicate, remove }: {
  rows: PromotionRow[];
  simulate: (row: PromotionRow) => void;
  menu: string | null;
  setMenu: (value: string | null) => void;
  update: (promotion: Promotion) => void;
  duplicate: (promotion: Promotion) => void;
  remove: (promotion: Promotion) => void;
}) {
  return <section className="card promotions-table-wrap"><table className="promotions-table"><thead><tr><th>Produto</th><th>Preço atual</th><th>Promoção</th><th>Preço promocional</th><th>Margem após promoção</th><th>Origem</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} onClick={() => simulate(row)}><td><b>{row.product.name}</b><small>{row.product.category}</small></td><td>{money(row.product.currentPrice)}</td><td>{row.discountValue ? row.type === 'percentage' ? `${row.discountValue}% OFF` : typeLabels[row.type] : 'Sem desconto sugerido'}</td><td>{row.discountValue ? money(row.promotionalPrice) : '—'}</td><td>{row.discountValue ? formatPercent(row.marginAfterPromotion) : '—'}</td><td><span className={`promotion-origin ${row.source}`}>{sourceLabel(row.source)}</span></td><td><PromotionStatusBadge status={row.status} /></td><td className="promotion-actions" onClick={(event) => event.stopPropagation()}><button onClick={() => setMenu(menu === row.id ? null : row.id)} aria-label={`Ações de ${row.product.name}`}><MoreHorizontal /></button>{menu === row.id && <div className="action-menu"><button onClick={() => simulate(row)}>{row.source === 'neqta' ? 'Simular' : 'Editar'}</button>{row.source === 'neqta' && row.discountValue > 0 && <button onClick={() => simulate(row)}>Usar promoção</button>}{row.source === 'manual' && <><button onClick={() => duplicate(row)}>Duplicar</button><button onClick={() => update({ ...row, status: 'ended' })}>Encerrar</button><button className="danger-action" onClick={() => remove(row)}>Excluir</button></>}</div>}</td></tr>)}</tbody></table></section>;
}

function PromotionCards({ rows, open }: { rows: PromotionRow[]; open: (row: PromotionRow) => void }) {
  return <section className="promotion-cards">{rows.map((row) => <article className="card promotion-card" key={row.id}><header><div><h2>{row.product.name}</h2><p>{sourceLabel(row.source)}</p></div><PromotionStatusBadge status={row.status} /></header><div><span>Preço atual<b>{money(row.product.currentPrice)}</b></span><span>Promoção<b>{row.discountValue ? row.type === 'percentage' ? `${row.discountValue}% OFF` : typeLabels[row.type] : '—'}</b></span><span>Preço promocional<b>{row.discountValue ? money(row.promotionalPrice) : '—'}</b></span><span>Margem após promoção<b>{row.discountValue ? formatPercent(row.marginAfterPromotion) : '—'}</b></span></div><button className="action-row" onClick={() => open(row)}>Ver promoção<ArrowRight /></button></article>)}</section>;
}

function PromotionStatusBadge({ status }: { status: PromotionStatus }) {
  return <span className={`promotion-status ${status}`}>{statusLabels[status]}</span>;
}

function PromotionPicker({ products, minimumMargin, close, choose }: { products: Product[]; minimumMargin:number; close: () => void; choose: (product: Product) => void }) {
  const [query, setQuery] = useState('');
  const sorted = products.filter((product) => product.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))).sort((a, b) => safeLimit(b,minimumMargin).maxDiscount - safeLimit(a,minimumMargin).maxDiscount);
  return createPortal(<div className="product-overlay promotion-picker-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="product-drawer promotion-picker" role="dialog" aria-modal="true" aria-label="Escolher produto para promoção"><header><div><h2>Nova promoção</h2><p>Escolha um produto para criar uma promoção.</p></div><button onClick={close} aria-label="Fechar"><X /></button></header><div className="product-drawer-content"><label className="product-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto..." autoFocus /></label><div className="promotion-picker-list">{sorted.map((product) => { const limit = safeLimit(product,minimumMargin); return <button key={product.id} onClick={() => choose(product)}><span><b>{product.name}</b><small>{product.category}</small></span><span><small>Preço atual</small><b>{money(product.currentPrice)}</b></span><span><small>Margem atual</small><b>{formatPercent(product.projectedMargin)}</b></span><span><small>Limite seguro</small><b>{limit.maxDiscount >= 1 ? `até ${limit.maxDiscount.toFixed(1).replace('.', ',')}% OFF` : 'Sem margem disponível'}</b></span><ArrowRight /></button>; })}</div></div></section></div>, document.body);
}

function PromotionDrawer({ product, products, settings, initial, source, close, save }: { product: Product; products: Product[]; settings:NeqtaSettings; initial?: Promotion; source: PromotionSource; close: () => void; save: (promotion: Promotion) => void }) {
  const minimumMargin=settings.financial.minimumMargin;
  const limit = safeLimit(product,minimumMargin);
  const suggestionDiscount = commercialDiscount(limit.maxDiscount);
  const suggestionPrice = product.currentPrice * (1 - suggestionDiscount / 100);
  const suggestionMargin = marginForChannel(suggestionPrice, product.variableCost, embeddedFees(product)) ?? 0;
  const [type, setType] = useState<PromotionType>(initial?.type ?? 'percentage');
  const [value, setValue] = useState(initial?.type === 'price' || initial?.type === 'combo' ? initial.promotionalPrice : initial?.discountValue ?? 0);
  const [secondaryProductId, setSecondaryProductId] = useState(initial?.secondaryProductId ?? '');
  const [selectedChannels, setChannels] = useState(initial?.channels?.length ? initial.channels : ['store']);
  const [startDate, setStart] = useState(initial?.startDate ?? '');
  const [endDate, setEnd] = useState(initial?.endDate ?? '');

  const secondaryProduct = type === 'combo' ? products.find((item) => item.id === secondaryProductId) : undefined;
  const referencePrice = product.currentPrice + (secondaryProduct?.currentPrice ?? 0);
  const consideredCost = product.variableCost + (secondaryProduct?.variableCost ?? 0);
  const embeddedFeeAmount = product.currentPrice * embeddedFees(product) / 100
    + (secondaryProduct ? secondaryProduct.currentPrice * embeddedFees(secondaryProduct) / 100 : 0);
  const combinedEmbeddedFees = referencePrice > 0 ? embeddedFeeAmount / referencePrice * 100 : 0;
  const financialReference = type === 'combo' && secondaryProduct
    ? { ...product, currentPrice: referencePrice, variableCost: consideredCost }
    : product;
  const activeLimit = safeLimit(financialReference, minimumMargin);

  let promotionalPrice = type === 'percentage'
    ? referencePrice * (1 - value / 100)
    : type === 'fixed'
      ? referencePrice - value
      : type === 'take2'
        ? value / 2
        : value;
  promotionalPrice = Math.max(0, promotionalPrice);

  const equivalentDiscount = referencePrice > 0 ? Math.max(0, (1 - promotionalPrice / referencePrice) * 100) : 0;
  const margin = marginForChannel(promotionalPrice, consideredCost, combinedEmbeddedFees) ?? 0;
  const contribution = promotionalPrice - consideredCost - promotionalPrice * combinedEmbeddedFees / 100;
  const status = statusFor(margin,minimumMargin);
  const noSpace = limit.maxDiscount < 1;
  const dateValid = !startDate || !endDate || endDate >= startDate;
  const financiallyValid = margin >= minimumMargin && contribution > 0 && promotionalPrice > consideredCost && status !== 'unsafe' && equivalentDiscount <= activeLimit.maxDiscount + 0.001;
  const valid = !noSpace && promotionalPrice > 0 && equivalentDiscount > 0 && financiallyValid && selectedChannels.length > 0 && dateValid && (type !== 'combo' || !!secondaryProduct);
  const availableChannels=settings.channels.filter(channel=>channel.active);
  const channelRows = availableChannels.filter((channel) => selectedChannels.includes(channel.id)).map((channel) => {
    const fee=channel.percentageFee+settings.financial.salesTax;const channelPrice = fee ? promotionalPrice / (1 - fee / 100) : promotionalPrice;
    return { ...channel, fee, price: channelPrice, margin: marginForChannel(channelPrice, consideredCost, combinedEmbeddedFees + fee,channel.fixedFee) ?? 0 };
  });

  function toggleChannel(id: string) {
    setChannels((current) => {
      if (current.includes(id)) return current.length === 1 ? current : current.filter((item) => item !== id);
      return [...current, id];
    });
  }

  function applySuggestion() {
    setType('percentage');
    setValue(suggestionDiscount);
  }

  return createPortal(<div className="product-overlay promotion-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><section className="product-drawer promotion-drawer" role="dialog" aria-modal="true" aria-label="Criar promoção"><header><div><h2>Criar promoção</h2><p>{product.name} · {product.category}</p></div><button onClick={close} aria-label="Fechar"><X /></button></header><div className="product-drawer-content promotion-drawer-content">
    <section className="promotion-current"><span>Custo variável<b>{money(product.variableCost)}</b></span><span>Preço atual<b>{money(product.currentPrice)}</b></span><span>Margem projetada<b>{formatPercent(product.projectedMargin)}</b></span><span>Margem mínima configurada<b>{formatPercent(minimumMargin)}</b></span></section>
    {noSpace && <section className="promotion-alert"><b>Este produto não possui margem disponível para desconto.</b><p>Revise o preço antes de criar uma promoção.</p><Link href={`${routes.pricing}?produto=${product.id}`}>Ir para Precificação</Link></section>}
    {!noSpace && suggestionDiscount > 0 && <section className="promotion-suggestion"><div><small>Sugestão NEQTA</small><strong>{suggestionDiscount}% OFF</strong><span>{money(product.currentPrice)} <ArrowRight /> {money(suggestionPrice)}</span><p>Margem após promoção: <b>{formatPercent(suggestionMargin)}</b></p></div><button className={`${buttonClass('ghost')} promotion-apply-suggestion`} onClick={applySuggestion}>Aplicar sugestão</button></section>}
    {!noSpace && <><section className="promotion-builder"><h3>Simular promoção</h3><label>Tipo de promoção<CustomSelect value={type} onChange={(next) => { const nextType = next as PromotionType; setType(nextType); setValue(0); if (nextType !== 'combo') setSecondaryProductId(''); }} ariaLabel="Tipo de promoção" options={(Object.keys(typeLabels) as PromotionType[]).map((key) => ({ value: key, label: typeLabels[key] }))} /></label>{type === 'combo' && <label>Produto adicional<CustomSelect value={secondaryProductId} onChange={setSecondaryProductId} ariaLabel="Produto adicional do combo" placeholder="Selecione um produto..." options={products.filter((item) => item.id !== product.id).map((item) => ({ value: item.id, label: `${item.name} · ${money(item.currentPrice)}` }))} /></label>}<label>{type === 'percentage' ? 'Desconto (%)' : type === 'fixed' ? 'Desconto (R$)' : type === 'take2' ? 'Preço total para 2 unidades' : type === 'combo' ? 'Preço do combo' : 'Preço promocional'}<input inputMode="decimal" value={type === 'percentage' ? value || '' : value ? money(value) : ''} onChange={(event) => setValue(type === 'percentage' ? parsePercent(event.target.value) : parseBRL(event.target.value))} /></label>
      <div className="promotion-result"><span className="promotion-result-primary">Preço promocional<b>{money(promotionalPrice)}</b></span><span className="promotion-result-primary">Margem após promoção<b>{formatPercent(margin)}</b></span><span>Desconto<b>{formatPercent(equivalentDiscount)}</b></span><span>Desconto máximo seguro<b>{formatPercent(activeLimit.maxDiscount)}</b></span><span>Contribuição estimada por unidade<b>{money(Math.max(0, contribution))}</b></span><span>Classificação<PromotionStatusBadge status={status} /></span></div>
      {!financiallyValid && equivalentDiscount > 0 && <p className="promotion-limit-warning">Esta promoção ultrapassa o limite seguro. Ajuste a oferta para continuar.</p>}
    </section>
    <section className="promotion-channels"><h3>Canais da promoção</h3><p>Escolha onde esta oferta será aplicada.</p><div className="channel-toggles" role="group" aria-label="Canais da promoção"><button className={selectedChannels.length === availableChannels.length ? 'active' : ''} aria-pressed={selectedChannels.length === availableChannels.length} onClick={() => setChannels(availableChannels.map((channel) => channel.id))}>Todos os canais</button>{availableChannels.map((channel) => <button key={channel.id} className={selectedChannels.includes(channel.id) ? 'active' : ''} aria-pressed={selectedChannels.includes(channel.id)} onClick={() => toggleChannel(channel.id)}>{channel.name}</button>)}</div><h3 className="channel-impact-title">Impacto financeiro por canal</h3><div className="promotion-channel-list">{channelRows.map((channel) => <article key={channel.id}><span><b>{channel.name}</b><small>{channel.fee ? `Taxas ${channel.fee}%` : 'Sem taxa'}</small></span><span><small>Preço promocional</small><b>{money(channel.price)}</b></span><span><small>Margem projetada</small><b>{formatPercent(channel.margin)}</b></span></article>)}</div></section>
    <section className="promotion-dates"><h3>Período da promoção</h3><label>Início <small>Opcional</small><input type="date" value={startDate} onChange={(event) => setStart(event.target.value)} /></label><label>Término <small>Opcional</small><input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEnd(event.target.value)} /></label>{!dateValid && <p>A data de término não pode ser anterior à data de início.</p>}</section></>}
  </div><footer className={`promotion-drawer-footer${noSpace ? ' no-promotion-footer' : ''}`}><button className={buttonClass('ghost')} onClick={close}>Cancelar</button>{!noSpace && <button className={buttonClass('primary')} disabled={!valid} onClick={() => save({ id: initial?.source === 'manual' ? initial.id : `promo-${Date.now()}`, productId: product.id, secondaryProductId: type === 'combo' ? secondaryProductId : undefined, type, discountValue: type === 'percentage' ? value : equivalentDiscount, promotionalPrice, marginAfterPromotion: margin, channels: selectedChannels, source, status: 'active', createdAt: initial?.createdAt ?? new Date().toISOString(), startDate: startDate || undefined, endDate: endDate || undefined })}>Salvar promoção</button>}</footer></section></div>, document.body);
}
