import { config } from 'dotenv';
config({ path: '.env.local' });
config();

const sql = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  EXECUTE sql;
END;
$$;
`;
const response = await fetch(process.env.SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
    'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY!,
  },
  body: JSON.stringify({ sql })
});
const text = await response.text();
console.log('Status:', response.status);
console.log('Response:', text);