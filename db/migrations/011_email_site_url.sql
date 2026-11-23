-- iŘemeslo – web běží na www.iremeslo.cz (Vercel). Odkazy i logo v e-mailech berou adresu z nastavení,
-- takže při změně domény stačí upravit ji v administraci /ssh → E-maily.

update app.settings set value = 'https://www.iremeslo.cz', updated_at = now()
where key = 'site_url' and value = 'https://iremeslo.cz';

create or replace function app.email_layout(p_title text, p_body_html text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select '<div style="margin:0;padding:24px 12px;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;color:#05264c">'
    || '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dfe4eb;border-radius:16px;overflow:hidden">'
    || '<div style="height:6px;background:#fe820d"></div>'
    || '<div style="padding:28px 28px 8px">'
    || '<p style="margin:0 0 20px"><img src="' || rtrim(coalesce(app.setting('site_url'), 'https://www.iremeslo.cz'), '/')
    || '/brand/logo-bez-sloganu.png" width="180" alt="iRemeslo.cz" '
    || 'style="display:block;width:180px;height:auto;border:0;font-size:22px;font-weight:800;color:#05264c"></p>'
    || '<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">' || p_title || '</h1>'
    || p_body_html
    || '</div>'
    || '<div style="padding:16px 28px 24px;font-size:13px;line-height:1.5;color:#556273;border-top:1px solid #dfe4eb">'
    || 'iRemeslo.cz – nabídky, zakázky a faktury pro řemeslníky.<br>'
    || 'Dotazy: <a href="mailto:info@iremeslo.cz" style="color:#b4540a">info@iremeslo.cz</a>'
    || '</div></div></div>'
$$;
revoke all on function app.email_layout(text, text) from public, anon, authenticated;
