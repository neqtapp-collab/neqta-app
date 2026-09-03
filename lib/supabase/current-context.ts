import { createClient } from '@/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export type CurrentProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export type CurrentOrganization = {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  active: boolean;
};

export type CurrentOrganizationMember = {
  organization_id: string;
  user_id: string;
  role: string;
  active: boolean;
};

export type CurrentStore = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  segment: string | null;
  cnpj: string | null;
  tax_regime: string | null;
  operating_days_per_month: number | null;
  timezone: string | null;
  active: boolean;
};

export type CurrentContext = {
  user: {
    id: string;
    email: string | null;
  };
  profile: CurrentProfile | null;
  membership: CurrentOrganizationMember | null;
  organization: CurrentOrganization | null;
  store: CurrentStore | null;
  displayName: string;
  initials: string;
  companyName: string;
};

let contextCache = new WeakMap<SupabaseClient, Promise<CurrentContext | null>>();

export function invalidateCurrentContext() {
  contextCache = new WeakMap<SupabaseClient, Promise<CurrentContext | null>>();
}

function getInitials(value: string) {
  const cleanValue = value.trim();

  if (!cleanValue) {
    return 'NE';
  }

  const parts = cleanValue
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return parts[0].slice(0, 2).toUpperCase();
}

async function loadCurrentContext(supabase: SupabaseClient): Promise<CurrentContext | null> {

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const [profileResult, membershipResult] = await Promise.all([
    supabase.from('profiles').select('id, full_name, avatar_url').eq('id', user.id).maybeSingle(),
    supabase.from('organization_members').select('organization_id, user_id, role, active').eq('user_id', user.id).eq('active', true).limit(1).maybeSingle(),
  ]);
  const { data: profile, error: profileError } = profileResult;
  const { data: membership, error: membershipError } = membershipResult;

  if (profileError) {
    console.error(
      'Erro ao carregar perfil do usuário:',
      profileError,
    );
  }

  if (membershipError) {
    console.error(
      'Erro ao carregar vínculo com a organização:',
      membershipError,
    );
  }

  let organization: CurrentOrganization | null = null;
  let store: CurrentStore | null = null;

  if (membership?.organization_id) {
    const [organizationResult, storeResult] = await Promise.all([
      supabase.from('organizations').select('id, name, slug, created_by, active').eq('id', membership.organization_id).eq('active', true).maybeSingle(),
      supabase.from('stores').select('id, organization_id, name, slug, segment, cnpj, tax_regime, operating_days_per_month, timezone, active').eq('organization_id', membership.organization_id).eq('active', true).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    ]);
    const { data: organizationData, error: organizationError } = organizationResult;
    const { data: storeData, error: storeError } = storeResult;

    if (organizationError) {
      console.error(
        'Erro ao carregar organização:',
        organizationError,
      );
    } else {
      organization =
        organizationData as CurrentOrganization | null;
    }

    if (storeError) {
      console.error(
        'Erro ao carregar loja:',
        storeError,
      );
    } else {
      store = storeData as CurrentStore | null;
    }
  }

  const emailName =
    user.email?.split('@')[0]?.trim() || '';

  const displayName =
    profile?.full_name?.trim() ||
    emailName ||
    'Usuário';

  const initials = getInitials(displayName);

  const companyName =
    store?.name ||
    organization?.name ||
    'Minha empresa';

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
    },
    profile:
      (profile as CurrentProfile | null) ?? null,
    membership:
      (membership as CurrentOrganizationMember | null) ??
      null,
    organization,
    store,
    displayName,
    initials,
    companyName,
  };
}

export function getCurrentContext(
  supabase: SupabaseClient = createClient(),
): Promise<CurrentContext | null> {
  const cached = contextCache.get(supabase);
  if (cached) return cached;
  const pending = loadCurrentContext(supabase).catch((error) => {
    contextCache.delete(supabase);
    throw error;
  });
  contextCache.set(supabase, pending);
  return pending;
}
