import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { transcribirAudio } from "@/lib/ai.functions";
import { blobABase64 } from "@/lib/imagen";

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

/** Browser dictation in es-AR, with server transcription fallback. Appends text via onTexto. */
export function useDictado(onTexto: (t: string) => void) {
  const [estado, setEstado] = useState<"idle" | "escuchando" | "grabando" | "transcribiendo">("idle");
  const recRef = useRef<SR | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const transcribir = useServerFn(transcribirAudio);
  const cbRef = useRef(onTexto);
  cbRef.current = onTexto;

  useEffect(() => () => {
    recRef.current?.stop();
    mediaRef.current?.stop();
  }, []);

  const iniciarGrabacion = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) return setEstado("idle");
        setEstado("transcribiendo");
        const r = await transcribir({ data: { audio: await blobABase64(blob), mime: blob.type || "audio/webm" } });
        if (r.ok) {
          if (r.texto) cbRef.current(r.texto);
        } else toast.error(r.mensaje);
        setEstado("idle");
      };
      mediaRef.current = rec;
      rec.start();
      setEstado("grabando");
    } catch {
      toast.error("No pudimos acceder al micrófono.");
      setEstado("idle");
    }
  }, [transcribir]);

  const iniciar = useCallback(() => {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return void iniciarGrabacion();
    const rec = new Ctor();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; if (res?.isFinal && res[0]) cbRef.current(res[0].transcript.trim());
      }
    };
    rec.onerror = (e) => {
      recRef.current = null;
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "network") {
        void iniciarGrabacion();
      } else setEstado("idle");
    };
    rec.onend = () => {
      if (recRef.current === rec) {
        recRef.current = null;
        setEstado((s) => (s === "escuchando" ? "idle" : s));
      }
    };
    recRef.current = rec;
    try {
      rec.start();
      setEstado("escuchando");
    } catch {
      recRef.current = null;
      void iniciarGrabacion();
    }
  }, [iniciarGrabacion]);

  const detener = useCallback(() => {
    if (recRef.current) {
      recRef.current.stop();
      recRef.current = null;
      setEstado("idle");
    }
    if (mediaRef.current && mediaRef.current.state !== "inactive") mediaRef.current.stop();
  }, []);

  return { estado, iniciar, detener, activo: estado === "escuchando" || estado === "grabando" };
}
