"use strict";(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[793],{1953:(e,t,r)=>{function i(e,t=""){return`ui-button ui-button--${e} ${t}`.trim()}r.d(t,{f:()=>i}),r(5155)},2125:(e,t,r)=>{r.d(t,{A:()=>i});let i=(0,r(9537).A)("plus",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]])},3363:(e,t,r)=>{r.d(t,{t:()=>a});var i=r(3512);function a(e,t,r){let a=new i.A(e||0),n=new i.A(r||0);return"g"===t||"ml"===t?a.div(1e3).mul(n).toDecimalPlaces(2).toNumber():"d\xfazia"===t?a.div(12).mul(n).toDecimalPlaces(2).toNumber():a.mul(n).toDecimalPlaces(2).toNumber()}},4577:(e,t,r)=>{r.d(t,{A:()=>i});let i=(0,r(9537).A)("check",[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]])},5377:(e,t,r)=>{r.d(t,{A:()=>i});let i=(0,r(9537).A)("search",[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]])},7268:(e,t,r)=>{r.d(t,{W:()=>v});var i=r(7236),a=r(7306),n=r(3363);let o=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;function c(e){if(null==e)return 0;let t=Number(e);return Number.isFinite(t)?t:0}function s(e,t){return e<=0?"warning":e<.75*t?"critical":e<t?"warning":"healthy"}function d(e){return JSON.stringify({version:1,description:e.description??"",variableCost:e.variableCost??0,targetMargin:e.targetMargin??0,recommendedPrice:e.recommendedPrice??e.currentPrice??0,components:e.components??[],packaging:e.packaging??[]})}function u(e){return(e??[]).reduce((e,t)=>e+c(t.quantity)*c(t.unitCost),0)}function l(e){return e.normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR")}function m(e,t){if(e.id===t.id)return!0;let r=l(e.name),i=l(t.name);return r===i||r.length>=5&&i.length>=5&&(r.includes(i)||i.includes(r))}async function g(e,t){let{data:r,error:i}=await e.from("neqta_records").select("record_key,data").eq("store_id",t).eq("namespace","cost-items");if(i)throw Error(`Erro ao carregar custos dos produtos: ${i.message}`);return(r??[]).map(e=>({...e.data,id:e.record_key}))}function p(e,t){let r=(e.components??[]).map(e=>{let r=t.find(t=>"ingredient"===t.type&&m(e,t));return r?{...e,id:r.id,name:r.name,unitCost:"g"===r.purchaseUnit||"ml"===r.purchaseUnit?1e3*r.baseUnitCost:r.baseUnitCost}:e}),i=(e.packaging??[]).map(e=>{let r=t.find(t=>"packaging"===t.type&&m(e,t));return r?{...e,id:r.id,name:r.name,unitCost:r.baseUnitCost}:e}),a=r.reduce((e,t)=>e+(0,n.t)(t.quantity,t.unit,t.unitCost),0)+u(i),o=e.currentPrice>0?(e.currentPrice-a)/e.currentPrice*100:0,c=e.targetMargin<100?a/(1-e.targetMargin/100):e.currentPrice;return{...e,components:r,packaging:i,variableCost:a,projectedMargin:o,recommendedPrice:c,status:s(o,e.targetMargin)}}function y(e){var t;let r=c(e.sale_price),i=function(e){if(!e)return{};try{let t=JSON.parse(e);return 1===t.version?t:{description:e}}catch{return{description:e}}}(e.description),a=Array.isArray(i.packaging)?i.packaging:[],n=i.variableCost??0,o=i.targetMargin??0,d=r>0?(r-n)/r*100:0,u=i.recommendedPrice??r;return{id:e.id,name:e.name,category:(t=e.product_categories)?Array.isArray(t)?t[0]?.name??"":t.name??"":"",variableCost:n,currentPrice:r,projectedMargin:d,targetMargin:o,recommendedPrice:u,status:s(d,o),kind:"product",yield:e.yield_quantity&&e.yield_unit?`${c(e.yield_quantity)} ${e.yield_unit}`:void 0,yieldQuantity:null!==e.yield_quantity?c(e.yield_quantity):void 0,yieldUnit:e.yield_unit??void 0,componentCount:i.components?.length??0,description:i.description??"",components:i.components??[],packaging:a}}async function _(e){let t=await (0,a.n)(e);if(!t)throw Error("N\xe3o foi poss\xedvel identificar o contexto atual do usu\xe1rio.");if(!t.store)throw Error("N\xe3o foi poss\xedvel identificar a loja atual.");return t.store.id}async function f(e,t){let r=e?.trim();if(!r)return null;let a=(0,i.U)(),{data:n,error:o}=await a.from("product_categories").select("id").eq("store_id",t).ilike("name",r).limit(1).maybeSingle();if(o)throw Error(`Erro ao localizar categoria: ${o.message}`);if(n?.id)return n.id;let{data:c,error:s}=await a.from("product_categories").insert({store_id:t,name:r}).select("id").single();if(s)throw Error(`Erro ao criar categoria: ${s.message}`);return c.id}async function w(e){let t=(0,i.U)(),r=await _(t),{data:a,error:n}=await t.from("products").select(`
      id,
      store_id,
      category_id,
      name,
      sku,
      description,
      sale_price,
      packaging_cost,
      is_base,
      yield_quantity,
      yield_unit,
      active,
      created_at,
      updated_at,
      product_categories (
        id,
        name
      )
    `).eq("id",e).eq("store_id",r).eq("active",!0).maybeSingle();if(n)throw Error(`Erro ao carregar produto: ${n.message}`);return a}let v={async list(e){let t=e??(0,i.U)(),r=await _(t),{data:a,error:n}=await t.from("products").select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `).eq("store_id",r).eq("active",!0).order("name",{ascending:!0});if(n)throw Error(`Erro ao carregar produtos: ${n.message}`);let o=await g(t,r);return a.map(y).map(e=>p(e,o))},async getById(e){let t=await w(e);if(!t)return null;let r=(0,i.U)(),a=await _(r);return p(y(t),await g(r,a))},async create(e){let t=(0,i.U)(),r=await _(t),a=await f(e.category,r),{data:n,error:o}=await t.from("products").insert({store_id:r,category_id:a,name:e.name.trim(),description:d(e),sale_price:e.currentPrice,packaging_cost:u(e.packaging),is_base:!1,active:!0}).select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `).single();if(o)throw Error(`Erro ao criar produto: ${o.message}`);return y(n)},async update(e,t){let r=(0,i.U)(),a=await _(r),n={},o=await w(e);if(!o)throw Error("Produto n\xe3o encontrado.");let c=y(o),s={name:t.name??c.name,category:t.category??c.category,currentPrice:t.currentPrice??c.currentPrice,targetMargin:t.targetMargin??c.targetMargin,kind:t.kind??c.kind,description:t.description??c.description,variableCost:t.variableCost??c.variableCost,recommendedPrice:t.recommendedPrice??c.recommendedPrice,components:t.components??c.components,packaging:t.packaging??c.packaging};void 0!==t.name&&(n.name=t.name.trim()),void 0!==t.currentPrice&&(n.sale_price=t.currentPrice),void 0!==t.category&&(n.category_id=await f(t.category,a)),(void 0!==t.description||void 0!==t.variableCost||void 0!==t.targetMargin||void 0!==t.recommendedPrice||void 0!==t.components||void 0!==t.packaging)&&(n.description=d(s)),void 0!==t.packaging&&(n.packaging_cost=u(s.packaging));let{data:l,error:m}=await r.from("products").update(n).eq("id",e).eq("store_id",a).select(`
        id,
        store_id,
        category_id,
        name,
        sku,
        description,
        sale_price,
        packaging_cost,
        is_base,
        yield_quantity,
        yield_unit,
        active,
        created_at,
        updated_at,
        product_categories (
          id,
          name
        )
      `).maybeSingle();if(m)throw Error(`Erro ao atualizar produto: ${m.message}`);if(!l)throw Error("Produto n\xe3o encontrado.");return y(l)},async save(e){return o.test(e.id)&&await this.getById(e.id)?this.update(e.id,{name:e.name,category:e.category,currentPrice:e.currentPrice,targetMargin:e.targetMargin,kind:e.kind,description:e.description,variableCost:e.variableCost,recommendedPrice:e.recommendedPrice,components:e.components,packaging:e.packaging}):this.create({name:e.name,category:e.category,currentPrice:e.currentPrice,targetMargin:e.targetMargin,kind:e.kind,description:e.description,variableCost:e.variableCost,recommendedPrice:e.recommendedPrice,components:e.components,packaging:e.packaging})},async remove(e){let t=(0,i.U)(),r=await _(t),{error:a}=await t.from("products").update({active:!1}).eq("id",e).eq("store_id",r);if(a)throw Error(`Erro ao remover produto: ${a.message}`)}}},9315:(e,t,r)=>{r.d(t,{$H:()=>n,M9:()=>m,TG:()=>p,Yd:()=>o,ZS:()=>l,Zx:()=>g,l9:()=>s,lo:()=>c,pL:()=>d,qe:()=>u});var i=r(3512),a=r(6312);function n(e,t){return e>0?new i.A(e).minus(t).div(e).mul(100).toNumber():0}function o(e){let t=e.replace(/\D/g,"");return t?new i.A(t).div(100).toNumber():0}function c(e){return(0,a.tb)(e)}function s(e){let t=(0,a.tb)(e),r=!Number.isInteger(t);return`${t.toLocaleString("pt-BR",{minimumFractionDigits:2*!!r,maximumFractionDigits:2})}%`}function d(e,t,r=0,a=0){let n=new i.A(1).minus(new i.A(t).div(100)).minus(new i.A(r).div(100));return n.lte(0)?0:new i.A(e).plus(a).div(n).toDecimalPlaces(2).toNumber()}function u(e,t,r=0,a=0){return e<=0?null:new i.A(e).minus(t).minus(new i.A(e).mul(r).div(100)).minus(a).div(e).mul(100).toDecimalPlaces(2).toNumber()}function l(e){return e<=0?0:new i.A(e).ceil().minus(.1).toDecimalPlaces(2).toNumber()}function m(e){return e.reduce((e,t)=>e.plus(t||0),new i.A(0)).toDecimalPlaces(2).toNumber()}function g(e,t){return new i.A(e||0).mul(t||0).toDecimalPlaces(2).toNumber()}function p(e){return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(e)}},9680:(e,t,r)=>{r.d(t,{A:()=>i});let i=(0,r(9537).A)("ellipsis",[["circle",{cx:"12",cy:"12",r:"1",key:"41hilf"}],["circle",{cx:"19",cy:"12",r:"1",key:"1wjl8i"}],["circle",{cx:"5",cy:"12",r:"1",key:"1pcz8c"}]])}}]);