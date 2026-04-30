import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { MapPin, Calendar, Loader2, Compass } from 'lucide-react';
import { toast } from 'sonner';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function Eventos() {
  const [coords, setCoords] = useState(null);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [permError, setPermError] = useState(null);

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setPermError('Geolocalização não suportada neste dispositivo');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setPermError(null);
      },
      (err) => {
        setPermError(err.message || 'Permissão negada');
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  };

  useEffect(() => { requestLocation(); }, []);

  useEffect(() => {
    if (!coords) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('eventos_comunidade')
          .select('*')
          .eq('status', 'approved')
          .order('data_evento', { ascending: true });
        if (error) throw error;
        const within = (data || [])
          .map((e) => {
            if (e.latitude == null || e.longitude == null) return null;
            const km = haversineKm(coords.lat, coords.lon, Number(e.latitude), Number(e.longitude));
            return { ...e, distancia_km: km };
          })
          .filter((e) => e && e.distancia_km <= 20)
          .sort((a, b) => a.distancia_km - b.distancia_km);
        setEventos(within);
      } catch (e) {
        toast.error('Falha ao carregar eventos');
      } finally {
        setLoading(false);
      }
    })();
  }, [coords]);

  return (
    <div className="space-y-5" data-testid="page-eventos">
      <section>
        <p className="text-[11px] uppercase tracking-[0.2em] text-gold/80 font-sans font-semibold">No seu raio</p>
        <h2 className="font-serif text-3xl text-foreground mt-1">Eventos · 20 km</h2>
        <div className="gold-divider w-16 mt-1" />
      </section>

      {permError && (
        <div className="rounded-xl border border-gold/20 bg-navy-light/30 p-4 text-sm text-foreground/80 space-y-3">
          <div className="flex items-start gap-2"><Compass size={16} className="text-gold mt-0.5" /> Precisamos da sua localização para listar eventos próximos.</div>
          <p className="text-xs text-foreground/60">{permError}</p>
          <Button onClick={requestLocation} data-testid="btn-permitir-gps" className="bg-gold text-navy-dark hover:bg-gold-soft">Tentar novamente</Button>
        </div>
      )}

      {loading && !permError && (
        <div className="flex items-center gap-2 text-foreground/70 text-sm"><Loader2 size={16} className="animate-spin" /> Carregando eventos…</div>
      )}

      {!loading && coords && eventos.length === 0 && (
        <div className="rounded-2xl border border-gold/15 bg-navy-light/30 p-6 text-foreground/70 text-sm">
          Nenhum evento aprovado num raio de 20km.
        </div>
      )}

      <ul className="space-y-3">
        {eventos.map((e) => (
          <li key={e.id} data-testid={`evento-${e.id}`} className="rounded-2xl border border-gold/15 bg-navy-light/30 p-5 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-serif text-xl text-foreground leading-tight">{e.titulo || e.nome}</h3>
              <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-gold border border-gold/40 rounded-full px-2 py-1">
                {e.distancia_km.toFixed(1)} km
              </span>
            </div>
            {e.descricao && <p className="text-foreground/80 text-sm font-sans leading-relaxed">{e.descricao}</p>}
            <div className="flex flex-wrap gap-3 pt-1 text-xs font-sans text-foreground/70">
              {e.data_evento && (
                <span className="inline-flex items-center gap-1"><Calendar size={12} className="text-gold" /> {formatDate(e.data_evento)}</span>
              )}
              {(e.endereco || e.local) && (
                <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-gold" /> {e.endereco || e.local}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
