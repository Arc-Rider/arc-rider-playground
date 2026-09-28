import { useEffect, useMemo, useRef, useState } from 'react';
import { ArcWidgetButton, ArcWidgetTable, type ArcWidgetTableData } from '@arcrider/arcwidgets-react';

const candidates = [
  { id: 'person-101', name: 'Mara Fischer', qualification: 'Veranstaltungstechnik · Aufbauleitung', availability: 100, suitability: 98 },
  { id: 'person-102', name: 'Jonas Weber', qualification: 'Veranstaltungstechnik · Bühne', availability: 100, suitability: 94 },
  { id: 'person-103', name: 'Lea Hoffmann', qualification: 'Veranstaltungstechnik · Licht', availability: 80, suitability: 91 },
  { id: 'person-104', name: 'Tim Berger', qualification: 'Aufbau · Logistik', availability: 100, suitability: 85 },
  { id: 'person-105', name: 'Nora Klein', qualification: 'Veranstaltungstechnik · Ton', availability: 60, suitability: 88 },
];

function trafficLight(value: number, highIsGood = true) {
  const score = highIsGood ? value : 100 - value;
  if (score >= 80) return { icon: 'arrow-up', color: '#15803d', label: 'Gut' };
  if (score >= 60) return { icon: 'arrow-right', color: '#a16207', label: 'Mittel' };
  return { icon: 'arrow-down', color: '#b91c1c', label: 'Niedrig' };
}

function Arrow({ direction, color }: { direction: string; color: string }) {
  const path = direction === 'arrow-up' ? 'M7 12V2m0 0L3 6m4-4 4 4' :
    direction === 'arrow-down' ? 'M7 2v10m0 0 4-4m-4 4L3 8' : 'M2 7h10m0 0L8 3m4 4-4 4';
  return <svg aria-hidden="true" viewBox="0 0 14 14" focusable="false" style={{ width: 14, height: 14, flex: 'none' }}>
    <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function StaffingPreview() {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const narrow = width < 500;
  const availabilityWidth = narrow ? '58px' : '120px';
  const suitabilityWidth = narrow ? '52px' : '90px';
  const actionWidth = narrow ? '88px' : '100px';
  const [selected, setSelected] = useState<string[]>([]);
  function toggle(id: string) {
    setSelected(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current);
  }
  const data = useMemo<ArcWidgetTableData>(() => ({
    height: '302px',
    header: { showHeader: true, height: '32px', fontSize: narrow ? '10px' : '11px', backgroundColor: '#f4f4f5', columns: [
      { title: 'Fachkraft', width: 'fraction', paddingX: '6px' },
      { title: <span title="Verfügbarkeit">{narrow ? 'Verfüg.' : 'Verfügbarkeit'}</span>, paddingX: '6px', width: availabilityWidth, align: 'right' },
      { title: 'Eignung', paddingX: '6px', width: suitabilityWidth, align: 'right' },
      { title: 'Aktion', paddingX: '6px', width: actionWidth },
    ] },
    styles: { fontSize: '12px', backgroundColor: '#fff', fontColor: '#27272a', borderRadius: '0px', borders: { outer: true, columns: false, rows: { color: '#e4e4e7', width: '1px' } } },
    table: candidates.map(person => {
      const active = selected.includes(person.id);
      const full = selected.length === 3 && !active;
      const availability = trafficLight(person.availability);
      const suitability = trafficLight(person.suitability);
      return {
        id: person.id, clickable: false, rowHeight: '52px', rowPaddingY: '2px', rowColor: active ? '#f4f4f5' : '#fff',
        columns: [
          { width: 'fraction', paddingX: '6px', value: <div className="candidate-name"><strong>{person.name}</strong><small className="candidate-detail">{narrow ? person.qualification.split(' · ').at(-1) : person.qualification}</small></div> },
          { paddingX: '6px', width: availabilityWidth, align: 'right', value: <span className="metric-value"><span>{person.availability} %</span><span className="metric-signal" role="img" aria-label={`Verfügbarkeit: ${availability.label}`}><Arrow direction={availability.icon} color={availability.color} /></span></span> },
          { paddingX: '6px', width: suitabilityWidth, align: 'right', value: <strong className="metric-value"><span>{person.suitability} %</span><span className="metric-signal" role="img" aria-label={`Eignung: ${suitability.label}`}><Arrow direction={suitability.icon} color={suitability.color} /></span></strong> },
          { paddingX: '6px', width: actionWidth, value: <div role="group" aria-label={`Auswahl ${person.name}`} aria-disabled={full}>
            <ArcWidgetButton id={`select-${person.id}`} data={{
              title: active ? 'Abwählen' : full ? (narrow ? 'Limit' : 'Limit erreicht') : 'Auswählen',
              height: '34px', width: narrow ? '76px' : '88px', fontSize: '11px', borderRadius: '0px',
              backgroundColor: active ? '#27272a' : '#f4f4f5', fontColor: active ? '#fff' : full ? '#a1a1aa' : '#27272a',
            }} onClick={() => toggle(person.id)} />
          </div> },
        ],
      };
    }),
  }), [selected, narrow, availabilityWidth, suitabilityWidth, actionWidth]);
  return <div className="staffing-preview" ref={container}>
    <header><p className="eyebrow">arcEvent · Ersatzsuche</p><h1>Ersatz für den Aufbau finden</h1><p>Lisa fällt krankheitsbedingt aus. Gesucht: Veranstaltungstechnik für Samstag, 08:00–16:00 Uhr.</p></header>
    <div className="summary"><span>5 mögliche Ersatzkräfte</span><strong role="status">{selected.length} von 3 ausgewählt</strong></div>
    <section aria-label="Ersatzkräfte"><div><ArcWidgetTable id="staffing-candidates" data={data} /></div></section>
    <p className="hint">Pfeile: Grün = gut (≥ 80 %), Gelb = mittel (60–79 %), Rot = niedrig (&lt; 60 %). Alle Personen und Prozentwerte sind fiktive Demo-Daten.</p>
    <div className="selection-summary"><strong>Deine Auswahl</strong><p>{selected.length ? selected.map(id => candidates.find(person => person.id === id)!.name).join(' · ') : 'Wähle bis zu drei Ersatzkräfte über die Spalte Aktion aus.'}</p>
      <p className="hint">Die Auswahl bleibt in dieser lokalen Vorschau. Es werden noch keine Anfragen verschickt.</p>
    </div>
  </div>;
}
