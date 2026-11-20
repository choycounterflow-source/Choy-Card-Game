import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  RotateCcw,
  Send,
  Sparkles,
  Upload,
} from 'lucide-react';

interface AIHubSuiteProps {
  gpsCoords: { lat: number; lng: number } | null;
  onOpen3DArena: () => void;
}

type StudioTab = 'chat' | 'maps' | 'transcribe';
type ChatModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';
type PersonaKey = 'coach' | 'analyst' | 'host';

interface ChatTurn {
  id: string;
  role: 'user' | 'model';
  text: string;
  model?: string;
}

interface MapsPlaceResult {
  title: string;
  uri: string;
  reviewSnippets: string[];
}

const PERSONA_OPTIONS: Array<{ id: PersonaKey; label: string; subtitle: string }> = [
  { id: 'coach', label: 'Coach Choy', subtitle: 'Tong-its, Pusoy & Lucky 9 Strategy' },
  { id: 'analyst', label: 'Odds Analyst', subtitle: 'Deadwood, Probabilities & VIP Math' },
  { id: 'host', label: 'VIP Lounge Host', subtitle: 'Rules, Table Etiquette & Tiers' },
];

const QUICK_MAPS_QUERIES = [
  'Nearby GCash and 7-Eleven Cash-In outlets open now',
  'Nearby internet cafes and gaming lounges',
  'Nearby Palawan Express, Cebuana Lhuillier, or ATMs',
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Failed to read audio data.'));
    reader.readAsDataURL(blob);
  });
}

export const AIHubSuite: React.FC<AIHubSuiteProps> = ({ gpsCoords, onOpen3DArena }) => {
  const [activeTab, setActiveTab] = useState<StudioTab>('chat');

  // ==================== MULTI-TURN GEMINI CHATBOT STATE ====================
  const [chatModel, setChatModel] = useState<ChatModel>('gemini-4-hydrogen');
  const [persona, setPersona] = useState<PersonaKey>('coach');
  const [chatHistory, setChatHistory] = useState<ChatTurn[]>([
    {
      id: 'welcome-turn',
      role: 'model',
      text: 'Maayong adlaw! I am Coach Choy powered by Gemini. Ask me how to arrange a tricky 13-card Pusoy hand, when to call Fight or Sapaw in Tong-its, or how to maximize VIP cashback!',
      model: 'gemini-4-hydrogen',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // ==================== GOOGLE MAPS GROUNDING STATE ====================
  const [mapsQuery, setMapsQuery] = useState(QUICK_MAPS_QUERIES[0]);
  const [mapsBusy, setMapsBusy] = useState(false);
  const [mapsError, setMapsError] = useState<string | null>(null);
  const [mapsAnswer, setMapsAnswer] = useState<string>('');
  const [mapsPlaces, setMapsPlaces] = useState<MapsPlaceResult[]>([]);

  // ==================== AUDIO TRANSCRIPTION STATE ====================
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [transcribeBusy, setTranscribeBusy] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [dictatingForChat, setDictatingForChat] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, chatBusy]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // ==================== CHAT HANDLERS ====================

  const sendChatMessage = async (textOverride?: string) => {
    const content = (textOverride ?? chatInput).trim();
    if (!content || chatBusy) return;

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: content,
    };

    const priorTurns = chatHistory.filter((t) => t.id !== 'welcome-turn');
    setChatHistory((prev) => [...prev, userTurn]);
    setChatInput('');
    setChatError(null);
    setChatBusy(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          model: chatModel,
          persona,
          history: priorTurns.map((t) => ({ role: t.role, text: t.text })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setChatError(data.error || 'Could not reach Gemini AI.');
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: 'model',
            text: data.reply,
            model: data.model || chatModel,
          },
        ]);
      }
    } catch {
      setChatError('Network error while contacting Gemini chat endpoint.');
    } finally {
      setChatBusy(false);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendChatMessage();
  };

  const resetChat = () => {
    setChatHistory([
      {
        id: 'welcome-turn',
        role: 'model',
        text: 'Conversation reset. Ready for your next card strategy, odds, or Choy Card Game VIP question!',
        model: chatModel,
      },
    ]);
    setChatError(null);
  };

  // ==================== GOOGLE MAPS GROUNDING HANDLER ====================

  const runMapsSearch = async (queryOverride?: string) => {
    const q = (queryOverride ?? mapsQuery).trim();
    if (!q || mapsBusy) return;
    setMapsQuery(q);
    setMapsBusy(true);
    setMapsError(null);

    try {
      const res = await fetch('/api/ai/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          lat: gpsCoords?.lat ?? null,
          lng: gpsCoords?.lng ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMapsError(data.error || 'Maps Grounding lookup failed.');
      } else {
        setMapsAnswer(data.text || '');
        setMapsPlaces(Array.isArray(data.places) ? data.places : []);
      }
    } catch {
      setMapsError('Network error while querying Google Maps Grounding.');
    } finally {
      setMapsBusy(false);
    }
  };

  // ==================== MICROPHONE & AUDIO TRANSCRIPTION HANDLERS ====================

  const sendAudioForTranscription = async (blob: Blob, forChatInput: boolean) => {
    setTranscribeBusy(true);
    setTranscribeError(null);
    try {
      const base64 = await blobToBase64(blob);
      const mimeType = blob.type || 'audio/webm';
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTranscribeError(data.error || 'Transcription failed.');
      } else {
        const text = String(data.transcript || '').trim();
        if (forChatInput) {
          setChatInput((prev) => (prev ? `${prev} ${text}` : text));
        } else {
          setTranscript(text || '(No speech detected in audio clip.)');
        }
      }
    } catch {
      setTranscribeError('Could not upload audio clip for transcription.');
    } finally {
      setTranscribeBusy(false);
      setDictatingForChat(false);
    }
  };

  const startRecording = async (forChatInput: boolean) => {
    if (recording || transcribeBusy) return;
    setTranscribeError(null);
    setDictatingForChat(forChatInput);

    if (!navigator.mediaDevices?.getUserMedia) {
      setTranscribeError('Microphone recording is not supported in this browser.');
      setDictatingForChat(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) audioChunksRef.current.push(evt.data);
      };
      recorder.onstop = () => {
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (audioBlob.size > 0) {
          sendAudioForTranscription(audioBlob, forChatInput);
        } else {
          setDictatingForChat(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch {
      setTranscribeError('Microphone access was denied. Allow mic permission or upload an audio file.');
      setDictatingForChat(false);
    }
  };

  const stopRecording = () => {
    if (!recording || !mediaRecorderRef.current) return;
    setRecording(false);
    mediaRecorderRef.current.stop();
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    sendAudioForTranscription(file, false);
    e.target.value = '';
  };

  const copyTranscriptText = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopiedTranscript(true);
      setTimeout(() => setCopiedTranscript(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      {/* Header Banner */}
      <section className="rounded-3xl border border-amber-400/35 bg-[#052920] p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white">
              Choy Card Game AI Coach, Maps & Voice Studio
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-emerald-200 max-w-2xl">
            Multi-turn Gemini card strategy chat, live Google Maps cash-in & lounge grounding, and instant microphone speech-to-text transcription.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpen3DArena}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 transition-colors whitespace-nowrap cursor-pointer"
        >
          Launch 3D VIP Dice Arena
        </button>
      </section>

      {/* Tool Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-emerald-800/80 pb-3">
        {[
          { id: 'chat' as StudioTab, label: 'Gemini Card Coach', icon: MessageSquare },
          { id: 'maps' as StudioTab, label: 'Nearby Cash-In & Maps', icon: MapPin },
          { id: 'transcribe' as StudioTab, label: 'Voice Transcriber', icon: Mic },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-amber-400 text-emerald-950'
                  : 'border border-emerald-800 bg-[#052920] text-emerald-200 hover:border-amber-400/70'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================== TAB 1: MULTI-TURN GEMINI CHATBOT ==================== */}
      {activeTab === 'chat' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Settings Rail */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block">
                Assistant Role
              </span>
              <div className="space-y-2">
                {PERSONA_OPTIONS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPersona(p.id)}
                    className={`w-full rounded-2xl border p-3 text-left transition-colors cursor-pointer ${
                      persona === p.id
                        ? 'border-amber-400 bg-amber-400/15 text-white'
                        : 'border-emerald-800 bg-[#031c16] text-emerald-200 hover:border-emerald-600'
                    }`}
                  >
                    <strong className="text-xs font-bold block">{p.label}</strong>
                    <span className="text-[11px] text-emerald-300">{p.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-4 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-300 block">
                Gemini Model Speed
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setChatModel('gemini-4-hydrogen')}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    chatModel === 'gemini-4-hydrogen'
                      ? 'border-amber-400 bg-amber-400 text-emerald-950'
                      : 'border-emerald-800 bg-[#031c16] text-emerald-100 hover:border-amber-400/60'
                  }`}
                >
                  <span className="text-xs font-extrabold block">Gemini 4 Hydrogen</span>
                  <span className="text-[11px] opacity-85">Balanced strategy & deep hand analysis</span>
                </button>
                <button
                  type="button"
                  onClick={() => setChatModel('gemini-3.1-flash-lite')}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer ${
                    chatModel === 'gemini-3.1-flash-lite'
                      ? 'border-amber-400 bg-amber-400 text-emerald-950'
                      : 'border-emerald-800 bg-[#031c16] text-emerald-100 hover:border-amber-400/60'
                  }`}
                >
                  <span className="text-xs font-extrabold block">Gemini 3.1 Flash-Lite</span>
                  <span className="text-[11px] opacity-85">Ultra-fast instant table rules & tips</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Scrollable Multi-Turn Thread */}
          <div className="lg:col-span-8 rounded-3xl border border-emerald-800/80 bg-[#052920] flex flex-col h-[540px] overflow-hidden shadow-xl">
            <div className="flex items-center justify-between border-b border-emerald-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-amber-400" />
                <span className="font-display text-sm font-bold text-white">
                  {PERSONA_OPTIONS.find((p) => p.id === persona)?.label} · {chatModel}
                </span>
              </div>
              <button
                type="button"
                onClick={resetChat}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-[#031c16] px-2.5 py-1.5 text-[11px] font-semibold text-emerald-200 hover:border-amber-400 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Thread
              </button>
            </div>

            <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatHistory.map((turn) => (
                <div
                  key={turn.id}
                  className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                      turn.role === 'user'
                        ? 'bg-amber-400 text-emerald-950 font-medium'
                        : 'border border-emerald-800 bg-[#031c16] text-emerald-50'
                    }`}
                  >
                    {turn.text}
                  </div>
                </div>
              ))}
              {chatBusy && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-emerald-800 bg-[#031c16] px-4 py-2.5 text-xs text-amber-300">
                    Thinking...
                  </div>
                </div>
              )}
              {chatError && (
                <div className="rounded-xl border border-red-500/60 bg-red-950/60 px-3.5 py-2.5 text-xs font-semibold text-red-200">
                  {chatError}
                </div>
              )}
            </div>

            <form
              onSubmit={handleChatSubmit}
              className="border-t border-emerald-800 bg-[#04241c] p-3 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => (recording ? stopRecording() : startRecording(true))}
                disabled={transcribeBusy}
                title={recording ? 'Stop voice dictation' : 'Dictate question with microphone'}
                className={`rounded-xl p-2.5 transition-colors cursor-pointer shrink-0 ${
                  recording && dictatingForChat
                    ? 'bg-red-600 text-white'
                    : 'border border-emerald-700 bg-[#031c16] text-emerald-200 hover:border-amber-400'
                }`}
              >
                {recording && dictatingForChat ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={
                  recording && dictatingForChat
                    ? `Listening (${recordSeconds}s)... tap mic to stop`
                    : 'Ask about Tong-its strategy, Pusoy hand order, or Lucky 9...'
                }
                className="flex-1 rounded-xl border border-emerald-700 bg-[#031c16] px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-emerald-500 focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={chatBusy || !chatInput.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ==================== TAB 2: GOOGLE MAPS GROUNDING ==================== */}
      {activeTab === 'maps' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                Google Maps Cash-In & Lounge Grounding
              </h2>
              <p className="text-xs text-emerald-300">
                Powered by Gemini 4 Hydrogen + live Google Maps tool
                {gpsCoords
                  ? ` · GPS Locked (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)})`
                  : ' · Using regional lookup'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {QUICK_MAPS_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => runMapsSearch(q)}
                className="rounded-xl border border-emerald-700 bg-[#031c16] px-3 py-2 text-xs font-semibold text-emerald-100 hover:border-amber-400 cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runMapsSearch();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={mapsQuery}
              onChange={(e) => setMapsQuery(e.target.value)}
              placeholder="Search nearby GCash outlets, 7-Eleven, lounges, or cafes..."
              className="flex-1 rounded-xl border border-emerald-700 bg-[#031c16] px-4 py-2.5 text-sm text-white placeholder:text-emerald-500 focus:border-amber-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={mapsBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <MapPin className="h-4 w-4" />
              {mapsBusy ? 'Searching Google Maps...' : 'Find Nearby Places'}
            </button>
          </form>

          {mapsError && (
            <div className="rounded-xl border border-red-500/60 bg-red-950/60 px-4 py-3 text-xs font-semibold text-red-200">
              {mapsError}
            </div>
          )}

          {mapsAnswer && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-800 bg-[#031c16] p-4 text-xs sm:text-sm text-emerald-50 leading-relaxed whitespace-pre-wrap">
                {mapsAnswer}
              </div>

              {mapsPlaces.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="font-display text-sm font-bold text-amber-300">
                    Verified Google Maps Places ({mapsPlaces.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {mapsPlaces.map((place) => (
                      <a
                        key={place.uri}
                        href={place.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-2xl border border-emerald-800 bg-[#031c16] p-4 hover:border-amber-400 transition-colors block space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-sm text-white">{place.title}</span>
                          <ExternalLink className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                        </div>
                        {place.reviewSnippets.length > 0 && (
                          <p className="text-xs text-emerald-300 line-clamp-2">
                            “{place.reviewSnippets[0]}”
                          </p>
                        )}
                        <span className="text-[11px] font-semibold text-amber-300 block">
                          Open in Google Maps →
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ==================== TAB 3: MICROPHONE AUDIO TRANSCRIPTION ==================== */}
      {activeTab === 'transcribe' && (
        <section className="rounded-3xl border border-emerald-800/80 bg-[#052920] p-5 sm:p-6 space-y-5 shadow-xl">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Microphone & Audio Transcriber (Gemini 3.5 Transcribe)
            </h2>
            <p className="text-xs text-emerald-300">
              Record live voice notes in English, Tagalog, or Bisaya — or upload an MP3/WAV/WebM clip for instant transcription.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-emerald-800 bg-[#031c16] p-5 flex flex-col items-center justify-center text-center gap-3">
              <button
                type="button"
                disabled={transcribeBusy}
                onClick={() => (recording ? stopRecording() : startRecording(false))}
                className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors cursor-pointer ${
                  recording && !dictatingForChat
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-400 text-emerald-950 hover:bg-amber-300'
                }`}
              >
                {recording && !dictatingForChat ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </button>
              <div>
                <p className="text-sm font-bold text-white">
                  {recording && !dictatingForChat
                    ? `Recording (${recordSeconds}s) — Tap to Stop & Transcribe`
                    : transcribeBusy
                      ? 'Transcribing with Gemini 3.5...'
                      : 'Tap Microphone to Record'}
                </p>
                <p className="text-[11px] text-emerald-300 mt-0.5">
                  Supports live voice commands, table notes, and multilingual speech.
                </p>
              </div>
            </div>

            <label className="rounded-2xl border border-dashed border-emerald-700 bg-[#031c16] p-5 flex flex-col items-center justify-center text-center gap-2.5 hover:border-amber-400 transition-colors cursor-pointer">
              <Upload className="h-7 w-7 text-amber-400" />
              <span className="text-sm font-bold text-white">Upload Audio File</span>
              <span className="text-[11px] text-emerald-300">
                MP3, WAV, WebM, or M4A clip
              </span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {transcribeError && (
            <div className="rounded-xl border border-red-500/60 bg-red-950/60 px-4 py-3 text-xs font-semibold text-red-200">
              {transcribeError}
            </div>
          )}

          {transcript && (
            <div className="rounded-2xl border border-amber-400/40 bg-[#031c16] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Transcription Output
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copyTranscriptText}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-700 bg-[#052920] px-2.5 py-1.5 text-xs font-semibold text-emerald-100 hover:border-amber-400 cursor-pointer"
                  >
                    {copiedTranscript ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedTranscript ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChatInput(transcript);
                      setActiveTab('chat');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-extrabold text-emerald-950 hover:bg-amber-300 cursor-pointer"
                  >
                    Ask AI Coach →
                  </button>
                </div>
              </div>
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{transcript}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
