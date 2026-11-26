import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabaseExternal';
import { requestMeetingVideo, videoErrorMessage } from '@/lib/seFeaturedMeeting';
import { safeLink } from '@/lib/seTraining';

export function FeaturedMeetingVideo({ meetingId, readaiUrl }: { meetingId: string; readaiUrl: string | null }) {
  const [video, setVideo] = useState<{ url: string | null; link: string | null; message: string | null }>({ url: null, link: safeLink(readaiUrl), message: null });
  const [loading, setLoading] = useState(false);
  const retried = useRef(false);
  const requestId = useRef(0);
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

  return <section className="space-y-3">
    <Button onClick={() => void load()} disabled={loading}>
      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
      {loading ? 'Carregando vídeo…' : 'Assistir'}
    </Button>
    {video.url && <video key={video.url} aria-label="Vídeo da reunião em destaque" controls playsInline autoPlay controlsList="nodownload" className="w-full aspect-video rounded-lg bg-muted" src={video.url} onError={() => void load(true)} />}
    {video.message && <div role="status" className="space-y-2">
      <p className="text-sm text-muted-foreground">{video.message}</p>
      {video.link && <Button asChild variant="outline" size="sm"><a href={video.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir na Read AI</a></Button>}
    </div>}
  </section>;
}