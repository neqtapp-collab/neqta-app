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

export async function getCurrentContext(
  supabase: SupabaseClient = createClient(),
): Promise<CurrentContext | null> {

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      'Erro ao carregar perfil do usuário:',
      profileError,
    );
  }

  const { data: membership, error: membershipError } =
    await supabase
      .from('organization_members')
      .select('organization_id, user_id, role, active')
      .eq('user_id', user.id)
      .eq('active', true)
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    console.error(
      'Erro ao carregar vínculo com a organização:',
      membershipError,
    );
  }

  let organization: CurrentOrganization | null = null;
  let store: CurrentStore | null = null;

  if (membership?.organization_id) {
    const {
      data: organizationData,
      error: organizationError,
    } = await supabase
      .from('organizations')
      .select('id, name, slug, created_by, active')
      .eq('id', membership.organization_id)
      .eq('active', true)
      .maybeSingle();

    if (organizationError) {
      console.error(
        'Erro ao carregar organização:',
        organizationError,
      );
    } else {
      organization =
        organizationData as CurrentOrganization | null;
    }

    const {
      data: storeData,
      error: storeError,
    } = await supabase
      .from('stores')
      .select(`
        id,
        organization_id,
        name,
        slug,
        segment,
        cnpj,
        tax_regime,
        operating_days_per_month,
        timezone,
        active
      `)
      .eq('organization_id', membership.organization_id)
      .eq('active', true)
      .order('created_at', {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

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
