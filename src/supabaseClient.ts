import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bmomxbaugmbsgoanykyn.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ERr9c4AWLFCw0mnkkcuSrA_E0WWdXHb'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const STORAGE_BUCKET = 'Gelendzhik-photo'
