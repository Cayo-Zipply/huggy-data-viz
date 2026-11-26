import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Maximize, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseExternal';
import { requestMeetingVideo, videoErrorMessage } from '@/lib/seFeaturedMeeting';
import { safeLink } from '@/lib/seTraining';

/** Painel escuro do destaque: capa com play antes do clique, vídeo ocupando o espaço depois. */
export function FeaturedMeetingVideo({ meetingId, readaiUrl, title, cover }: { meetingId: string; readaiUrl: string | null; title: string; cover?: React.ReactNode }) {
  const [video, setVideo] = useState<{ url: string | null; link: string | null; message: string | null }>({ url: null, link: safeLink(readaiUrl), message: null });
  const [loading, setLoading] = useState(false);
  const retried = useRef(false);
  const requestId = useRef(0);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => () => { requestId.current += 1; }, []);

  const load = async (retry = false) => {
    if (retry && retried.current) {
      setVideo(v => ({ ...v, url: null, message: videoErrorMessage() }));
      return;
    }
    retried.current = retry;
    const id = ++requestId.current;
    setLoading(true);
    setVideo(v => ({ ...v, url: null, message: null }));
    const result = await requestMeetingVideo(supabase, meetingId, readaiUrl);
    if (id !== requestId.current) return;
    setVideo(result);
    setLoading(false);
  };
  const fullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.requestFullscreen?.(); };

  return <div ref={stage} className="training-video-dialog relative flex h-full min-h-[240px] w-full items-center justify-center overflow-hidden rounded-xl">
    {video.url ? <>
      <video key={video.url} aria-label="Vídeo da reunião em destaque" controls playsInline autoPlay controlsList="nodownload" className="absolute inset-0 h-full w-full object-contain" src={video.url} onError={() => void load(true)} />
      <Button type="button" size="icon" variant="outline" aria-label="Tela cheia" title="Tela cheia" onClick={fullscreen} className="absolute right-3 top-3 bg-background/70"><Maximize className="h-4 w-4" /></Button>
    </> : <div className="flex max-w-full flex-col items-center gap-5 p-6 text-center">
      <p className="break-words text-2xl font-semibold md:text-3xl">{title}</p>
      {cover}
      <button type="button" onClick={() => void load()} disabled={loading} aria-label={loading ? 'Carregando vídeo' : 'Assistir'} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70">
        {loading ? <Loader2 className="h-9 w-9 animate-spin" /> : <Play className="h-9 w-9 translate-x-0.5 fill-current" />}
      </button>
      {video.message && <div role="status" className="space-y-2">
        <p className="text-sm text-muted-foreground">{video.message}</p>
        {video.link && <Button asChild variant="outline" size="sm"><a href={video.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir na Read AI</a></Button>}
      </div>}
    </div>}
  </div>;
}
