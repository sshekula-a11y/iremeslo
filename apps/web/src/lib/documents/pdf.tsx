/* PDF dokladu. Vytváří se v prohlížeči (načítá se až po kliknutí), server tím nezatěžujeme. */
import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { toRoman, type DocumentView } from "./view";

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  const base = `${window.location.origin}/fonts/pdf`;
  Font.register({
    family: "Inter",
    fonts: [
      { src: `${base}/Inter_400Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Inter_600SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}/Inter_700Bold.ttf`, fontWeight: 700 },
    ],
  });
  Font.register({ family: "Archivo", src: `${base}/Archivo_800ExtraBold.ttf`, fontWeight: 800 });
  // Česká slova nedělit spojovníkem.
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const INK = "#05264c";
const MUTED = "#556273";
const LINE = "#dfe4eb";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9, color: INK, paddingTop: 0, paddingBottom: 48, paddingHorizontal: 40 },
  bar: { height: 6, marginHorizontal: -40, marginBottom: 28 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 22 },
  supplierName: { fontFamily: "Archivo", fontWeight: 800, fontSize: 16, maxWidth: 260 },
  logo: { maxHeight: 48, maxWidth: 180, objectFit: "contain" },
  heading: { fontFamily: "Archivo", fontWeight: 800, fontSize: 20, textAlign: "right", textTransform: "uppercase" },
  number: { fontSize: 11, fontWeight: 600, textAlign: "right", marginTop: 2 },
  parties: { flexDirection: "row", gap: 16, marginBottom: 16 },
  party: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10 },
  partyLabel: { fontSize: 7.5, fontWeight: 600, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 3 },
  partyLine: { color: MUTED, marginTop: 2 },
  meta: { flexDirection: "row", flexWrap: "wrap", marginBottom: 14 },
  metaItem: { width: "50%", flexDirection: "row", paddingVertical: 2 },
  metaLabel: { width: 92, color: MUTED },
  metaValue: { flex: 1, fontWeight: 600 },
  title: { fontSize: 12, fontWeight: 700, marginBottom: 8 },
  th: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  thText: { fontSize: 7.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 },
  tr: { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: LINE },
  cDesc: { flex: 1, paddingRight: 8 },
  cQty: { width: 52, textAlign: "right" },
  cUnit: { width: 38, paddingLeft: 6 },
  cPrice: { width: 72, textAlign: "right" },
  cTotal: { width: 80, textAlign: "right" },
  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 18, marginTop: 12 },
  totals: { width: 240 },
  recap: { flex: 1, maxWidth: 260 },
  recapTitle: { fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 },
  recapRow: { flexDirection: "row", paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  rLabel: { flex: 1 },
  rNum: { width: 58, textAlign: "right" },
  pay: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 18, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 12 },
  payLines: { flex: 1, gap: 2 },
  payLine: { flexDirection: "row" },
  payLabel: { width: 92, color: MUTED },
  payValue: { flex: 1, fontWeight: 600 },
  payAmountLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  payAmount: { fontFamily: "Archivo", fontWeight: 800, fontSize: 16, marginTop: 2 },
  qr: { width: 84, alignItems: "center" },
  qrImage: { width: 84, height: 84 },
  qrCaption: { fontSize: 7, color: MUTED, marginTop: 3 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
  grandLabel: { fontSize: 10, fontWeight: 700 },
  grandValue: { fontFamily: "Archivo", fontWeight: 800, fontSize: 15 },
  notes: { marginTop: 18, gap: 3 },
  sign: { marginTop: 24, alignSelf: "flex-end", width: 200, alignItems: "center" },
  signImages: { height: 64, flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 8 },
  signImage: { maxHeight: 64, maxWidth: 120, objectFit: "contain" },
  signLine: { width: "100%", borderTopWidth: 1, borderTopColor: LINE, marginTop: 4, paddingTop: 4, textAlign: "center", color: MUTED, fontSize: 7.5 },
  note: { color: INK },
  article: { marginBottom: 9 },
  articleTitle: { fontSize: 10, fontWeight: 700, marginBottom: 3 },
  articleText: { marginBottom: 3 },
  blankLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 8 },
  blankLine: { height: 18, borderBottomWidth: 1, borderBottomColor: "#9aa5b4", borderBottomStyle: "dotted" },
  signs: { flexDirection: "row", gap: 40, marginTop: 26 },
  signCol: { flex: 1, alignItems: "center" },
  place: { marginTop: 18 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 22, flexDirection: "row", justifyContent: "space-between", color: MUTED, fontSize: 7.5, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 6 },
});

export function DocumentPdf({ v }: { v: DocumentView }) {
  const grand = v.totals.find((t) => t.strong);
  const rest = v.totals.filter((t) => !t.strong);
  const [supplierLabel, customerLabel] = v.partyLabels ?? ["Dodavatel", "Odběratel"];
  const hasItems = v.rows.length > 0 || v.totals.length > 0;
  return (
    <Document title={`${v.heading} ${v.number}`} author={v.supplier.name} creator="iŘemeslo.cz" producer="iŘemeslo.cz" language="cs">
      <Page size="A4" style={s.page}>
        <View style={[s.bar, { backgroundColor: v.accent }]} fixed />
        <View style={s.head}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image nemá alt */}
          {v.logoUrl ? <Image src={v.logoUrl} style={s.logo} /> : <Text style={s.supplierName}>{v.supplier.name}</Text>}
          <View style={{ maxWidth: 270, alignItems: "flex-end" }}>
            <Text style={[s.heading, v.heading.length > 20 ? { fontSize: 15 } : {}]}>{v.heading}</Text>
            <Text style={s.number}>č. {v.number}</Text>
          </View>
        </View>

        <View style={s.parties}>
          <PartyBox label={supplierLabel} party={v.supplier} />
          {v.customer ? <PartyBox label={customerLabel} party={v.customer} /> : <View style={[s.party, { borderStyle: "dashed" }]} />}
        </View>

        <View style={s.meta}>
          {v.meta.map((m) => (
            <View key={m.label} style={s.metaItem}>
              <Text style={s.metaLabel}>{m.label}</Text>
              <Text style={s.metaValue}>{m.value}</Text>
            </View>
          ))}
        </View>

        <Text style={s.title}>{v.title}</Text>

        {v.articles?.map((a, i) => (
          <View key={i} style={s.article}>
            <Text style={s.articleTitle} minPresenceAhead={30}>{toRoman(i + 1)}. {a.title}</Text>
            {a.paragraphs.map((p, j) => <Text key={j} style={s.articleText}>{p}</Text>)}
          </View>
        ))}

        {v.blanks?.map((b) => (
          <View key={b.label} wrap={false}>
            <Text style={s.blankLabel}>{b.label}</Text>
            {Array.from({ length: b.lines }, (_, k) => <View key={k} style={s.blankLine} />)}
          </View>
        ))}

        {hasItems && <>
        <View style={[s.th, { backgroundColor: v.accent }]} fixed>
          {(["description", "qty", "unit", "unitPrice", "total"] as const).map((k) => (
            <Text key={k} style={[s.thText, col(k), { color: v.accentText }]}>{v.columns[k]}</Text>
          ))}
        </View>
        {v.rows.map((r, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.cDesc}>{r.description}</Text>
            <Text style={s.cQty}>{r.qty}</Text>
            <Text style={s.cUnit}>{r.unit}</Text>
            <Text style={s.cPrice}>{r.unitPrice}</Text>
            <Text style={[s.cTotal, { fontWeight: 600 }]}>{r.total}</Text>
          </View>
        ))}

        <View style={s.summary} wrap={false}>
          {v.recap ? (
            <View style={s.recap}>
              <Text style={s.recapTitle}>Rekapitulace DPH</Text>
              <View style={[s.recapRow, { borderBottomColor: INK }]}>
                <Text style={[s.rLabel, { fontWeight: 600 }]}>Sazba</Text>
                <Text style={[s.rNum, { fontWeight: 600 }]}>Základ</Text>
                <Text style={[s.rNum, { fontWeight: 600 }]}>DPH</Text>
                <Text style={[s.rNum, { fontWeight: 600 }]}>Celkem</Text>
              </View>
              {v.recap.map((r, i) => (
                <View key={i} style={s.recapRow}>
                  <Text style={[s.rLabel, r.muted ? { color: MUTED } : {}]}>{r.label}</Text>
                  <Text style={s.rNum}>{r.base}</Text>
                  <Text style={s.rNum}>{r.vat}</Text>
                  <Text style={s.rNum}>{r.total}</Text>
                </View>
              ))}
            </View>
          ) : <View />}
        <View style={s.totals}>
          {rest.map((t) => (
            <View key={t.label} style={s.totalRow}>
              <Text style={{ color: MUTED, flex: 1, paddingRight: 10 }}>{t.label}</Text>
              <Text style={{ textAlign: "right" }}>{t.value}</Text>
            </View>
          ))}
          {grand && (
            <View style={[s.grand, { backgroundColor: v.accent }]}>
              <Text style={[s.grandLabel, { color: v.accentText }]}>{grand.label}</Text>
              <Text style={[s.grandValue, { color: v.accentText }]}>{grand.value}</Text>
            </View>
          )}
        </View>
        </View>

        {v.payment && (
          <View style={s.pay} wrap={false}>
            <View style={s.payLines}>
              {v.payment.lines.map((l) => (
                <View key={l.label} style={s.payLine}>
                  <Text style={s.payLabel}>{l.label}</Text>
                  <Text style={s.payValue}>{l.value}</Text>
                </View>
              ))}
            </View>
            <View>
              <Text style={s.payAmountLabel}>K úhradě</Text>
              <Text style={s.payAmount}>{v.payment.amount}</Text>
            </View>
            {v.payment.qrDataUrl && (
              <View style={s.qr}>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image nemá alt */}
                <Image src={v.payment.qrDataUrl} style={s.qrImage} />
                <Text style={s.qrCaption}>QR Platba</Text>
              </View>
            )}
          </View>
        )}

        </>}

        {v.notes.length > 0 && (
          <View style={s.notes} wrap={false}>
            {v.notes.map((n, i) => <Text key={i} style={s.note}>{n}</Text>)}
          </View>
        )}

        {v.signatures && (
          <View wrap={false}>
            {v.signatures.place && <Text style={s.place}>V ……………………… dne ………………</Text>}
            <View style={s.signs}>
              <View style={s.signCol}>
                <View style={s.signImages}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image nemá alt */}
                  {v.stampUrl && <Image src={v.stampUrl} style={s.signImage} />}
                  {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image nemá alt */}
                  {v.signatureUrl && <Image src={v.signatureUrl} style={s.signImage} />}
                </View>
                <Text style={s.signLine}>{v.signatures.left}{"\n"}{v.supplier.name}</Text>
              </View>
              <View style={s.signCol}>
                <View style={s.signImages} />
                <Text style={s.signLine}>{v.signatures.right}{"\n"}{v.customer?.name ?? ""}</Text>
              </View>
            </View>
          </View>
        )}

        {!v.signatures && (v.stampUrl || v.signatureUrl) && (
          <View style={s.sign} wrap={false}>
            <View style={s.signImages}>
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image nemá alt */}
              {v.stampUrl && <Image src={v.stampUrl} style={s.signImage} />}
              {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image nemá alt */}
              {v.signatureUrl && <Image src={v.signatureUrl} style={s.signImage} />}
            </View>
            <Text style={s.signLine}>Razítko a podpis dodavatele</Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>{v.footer}</Text>
          <Text render={({ pageNumber, totalPages }) => `${v.number} · strana ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

function col(k: "description" | "qty" | "unit" | "unitPrice" | "total") {
  return { description: s.cDesc, qty: s.cQty, unit: s.cUnit, unitPrice: s.cPrice, total: s.cTotal }[k];
}

function PartyBox({ label, party }: { label: string; party: { name: string; lines: string[] } }) {
  return (
    <View style={s.party}>
      <Text style={s.partyLabel}>{label}</Text>
      <Text style={s.partyName}>{party.name}</Text>
      {party.lines.map((l, i) => <Text key={i} style={s.partyLine}>{l}</Text>)}
    </View>
  );
}

export async function documentPdfBlob(v: DocumentView): Promise<Blob> {
  registerFonts();
  return pdf(<DocumentPdf v={v} />).toBlob();
}
