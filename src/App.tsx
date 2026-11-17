import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  UploadCloud,
  Scissors,
  Type as TypeIcon,
  Sliders,
  FolderKanban,
  Download,
  Coins,
  Crown,
  Settings,
  Shield,
  Home,
  Compass,
  Menu,
  X,
  Play,
  CheckCircle2,
  AlertCircle,
  LogOut,
  LogIn,
  Trash2,
  Smartphone,
  Server,
  MessageSquare,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, signOut, testFirestoreConnection } from './lib/firebase';
import {
  MEMBERSHIP_PLANS,
  TUTORIAL_STEPS,
} from './data/studioCatalog';
import type {
  AspectRatio,
  DashboardSection,
  ExportPlatform,
  ExportRecord,
  ExportResolution,
  MembershipPlan,
  PaymentRecord,
  SupportTicket,
  UserProfile,
  VideoClip,
  VideoProject,
} from './types/clipverse';
import { AuthModal } from './components/AuthModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { VideoPreviewPlayer } from './components/VideoPreviewPlayer';
import { CaptionStudio } from './components/CaptionStudio';
import { VideoEditorPanel } from './components/VideoEditorPanel';
import { MembershipUpiPanel } from './components/MembershipUpiModal';
import { AdminPanel } from './components/AdminPanel';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
}

function toMillis(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'string') {
    const t = Date.parse(val);
    return Number.isFinite(t) ? t : 0;
  }
  if (
    typeof val === 'object' &&
    val !== null &&
    'toMillis' in val &&
    typeof (val as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  if (typeof val === 'object' && val !== null && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  return 0;
}

export default function App() {
  const [section, setSection] = useState<DashboardSection>('welcome');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Auth & Firestore state
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>(MEMBERSHIP_PLANS);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [exportsList, setExportsList] = useState<ExportRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  // Active workspace studio state
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [clips, setClips] = useState<VideoClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);

  // Upload & AI Processing state
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadLanguage, setUploadLanguage] = useState('English');
  const [uploadRatio, setUploadRatio] = useState<AspectRatio>('9:16');
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [translatingCaptions, setTranslatingCaptions] = useState(false);
  const [exportingMp4, setExportingMp4] = useState(false);
  const [bannerError, setBannerError] = useState('');
  const [bannerSuccess, setBannerSuccess] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Interactive Tutorial state
  const [tutorialActive, setTutorialActive] = useState<boolean>(() => {
    return localStorage.getItem('clipverse_tutorial_dismissed') !== 'true';
  });
  const [tutorialMinimized, setTutorialMinimized] = useState(false);
  const [tutorialStepIndex, setTutorialStepIndex] = useState<number>(() => {
    const saved = Number(localStorage.getItem('clipverse_tutorial_step') || 0);
    return Number.isFinite(saved) && saved >= 0 && saved < TUTORIAL_STEPS.length ? saved : 0;
  });
  const [completedStepIds, setCompletedStepIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('clipverse_tutorial_done') || '["step-welcome"]');
    } catch {
      return ['step-welcome'];
    }
  });

  // Support ticket & settings form state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [watermarkDraft, setWatermarkDraft] = useState('');
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [settingsTab, setSettingsTab] = useState<'account' | 'support' | 'android'>('account');

  const activeClip = clips.find((c) => c.id === activeClipId) || clips[0] || null;
  const userPlan = userProfile?.plan || 'FREE';
  const isAdmin =
    userProfile?.role === 'admin' || fbUser?.email === 'rajenbarla13@gmail.com';

  const markTutorialStepDone = useCallback((stepId: string, nextStepIdx?: number) => {
    setCompletedStepIds((prev) => {
      const next = prev.includes(stepId) ? prev : [...prev, stepId];
      localStorage.setItem('clipverse_tutorial_done', JSON.stringify(next));
      return next;
    });
    if (typeof nextStepIdx === 'number') {
      setTutorialStepIndex(nextStepIdx);
      localStorage.setItem('clipverse_tutorial_step', String(nextStepIdx));
    }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'plans'));
      if (!snap.empty) {
        const list = snap.docs.map((d) => d.data() as MembershipPlan);
        list.sort((a, b) => a.priceInr - b.priceInr);
        setPlans(list);
        return;
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'plans');
    }
    setPlans(MEMBERSHIP_PLANS);
  }, []);

  const syncUserProfile = useCallback(
    async (user: User) => {
      const token = await user.getIdToken();
      setAuthToken(token);

      if (!user.emailVerified) {
        setBannerError(
          'Please verify your email address (or sign in with Google) to sync your projects and UPI payments.'
        );
        return;
      }

      const isAdminUser = user.email === 'rajenbarla13@gmail.com' && user.emailVerified;
      const userRef = doc(db, 'users', user.uid);

      try {
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          const initialProfile: UserProfile = {
            uid: user.uid,
            email: (user.email || '').slice(0, 200),
            displayName: (
              user.displayName ||
              (user.email ? user.email.split('@')[0] : 'Creator')
            ).slice(0, 120),
            photoURL: (user.photoURL || '').slice(0, 500),
            plan: 'FREE',
            planExpiresAt: null,
            credits: 50,
            dailyProjectsUsed: 0,
            dailyMinutesUsed: 0,
            storageUsedMb: 0,
            role: isAdminUser ? 'admin' : 'user',
            status: 'active',
            tutorialCompleted: false,
            tutorialStep: 1,
            preferredLanguage: 'English',
            watermarkText: '',
          };
          await setDoc(userRef, {
            ...initialProfile,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setUserProfile(initialProfile);
          setWatermarkDraft('');
          setDisplayNameDraft(initialProfile.displayName);
        } else {
          const data = snap.data() as UserProfile;
          const isExpired =
            data.plan !== 'FREE' &&
            Boolean(data.planExpiresAt) &&
            Date.parse(String(data.planExpiresAt)) < Date.now();

          if (isExpired && isAdminUser) {
            await updateDoc(userRef, {
              plan: 'FREE',
              planExpiresAt: null,
              updatedAt: serverTimestamp(),
            });
          }

          const effectiveProfile: UserProfile = isExpired
            ? { ...data, plan: 'FREE', planExpiresAt: null }
            : data;
          setUserProfile(effectiveProfile);
          setWatermarkDraft(effectiveProfile.watermarkText || '');
          setDisplayNameDraft(effectiveProfile.displayName || user.displayName || '');
        }

        if (isAdminUser) {
          const adminRef = doc(db, 'admins', user.uid);
          const adminSnap = await getDoc(adminRef);
          if (!adminSnap.exists()) {
            await setDoc(adminRef, {
              uid: user.uid,
              email: user.email || 'rajenbarla13@gmail.com',
            });
          }

          const plansSnap = await getDocs(collection(db, 'plans'));
          if (plansSnap.empty) {
            await Promise.all(
              MEMBERSHIP_PLANS.map((pl) => setDoc(doc(db, 'plans', pl.id), pl))
            );
            await fetchPlans();
          }

          const promosSnap = await getDocs(collection(db, 'promoCodes'));
          if (promosSnap.empty) {
            await Promise.all([
              setDoc(doc(db, 'promoCodes', 'ANIME20'), {
                id: 'ANIME20',
                code: 'ANIME20',
                discountPercent: 20,
                active: true,
                usesCount: 0,
              }),
              setDoc(doc(db, 'promoCodes', 'CREATOR50'), {
                id: 'CREATOR50',
                code: 'CREATOR50',
                discountPercent: 50,
                active: true,
                usesCount: 0,
              }),
            ]);
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      }
    },
    [fetchPlans]
  );

  // Initialize connection & Firebase Auth observer
  useEffect(() => {
    testFirestoreConnection();
    fetchPlans();

    const unsub = onAuthStateChanged(auth, async (user) => {
      setFbUser(user);
      if (user) {
        await syncUserProfile(user);
      } else {
        setAuthToken(null);
        setUserProfile(null);
        setProjects([]);
        setExportsList([]);
        setPayments([]);
        setTickets([]);
      }
    });
    return () => unsub();
  }, [fetchPlans, syncUserProfile]);

  // Firestore real-time subscriptions for authenticated verified user
  useEffect(() => {
    if (!fbUser || !fbUser.emailVerified) return;

    const unsubProfile = onSnapshot(
      doc(db, 'users', fbUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as UserProfile;
          setUserProfile(data);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`)
    );

    const projQuery = query(
      collection(db, 'projects'),
      where('userId', '==', fbUser.uid)
    );
    const unsubProjects = onSnapshot(
      projQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as VideoProject), id: d.id }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setProjects(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'projects')
    );

    const expQuery = query(
      collection(db, 'exports'),
      where('userId', '==', fbUser.uid)
    );
    const unsubExports = onSnapshot(
      expQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as ExportRecord), id: d.id }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setExportsList(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'exports')
    );

    const payQuery = query(
      collection(db, 'payments'),
      where('userId', '==', fbUser.uid)
    );
    const unsubPayments = onSnapshot(
      payQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as PaymentRecord), id: d.id }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setPayments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'payments')
    );

    const ticketQuery = query(
      collection(db, 'tickets'),
      where('userId', '==', fbUser.uid)
    );
    const unsubTickets = onSnapshot(
      ticketQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ ...(d.data() as SupportTicket), id: d.id }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setTickets(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'tickets')
    );

    return () => {
      unsubProfile();
      unsubProjects();
      unsubExports();
      unsubPayments();
      unsubTickets();
    };
  }, [fbUser]);

  // Subscribe to clips of activeProject when saved in Firestore
  useEffect(() => {
    if (!fbUser || !fbUser.emailVerified || !activeProject || activeProject.userId !== fbUser.uid) return;
    const clipsCol = collection(db, 'projects', activeProject.id, 'clips');
    const unsub = onSnapshot(
      clipsCol,
      (snap) => {
        if (!snap.empty) {
          const list = snap.docs.map((d) => ({ ...(d.data() as VideoClip), id: d.id }));
          list.sort((a, b) => b.viralScore - a.viralScore);
          setClips(list);
          setActiveClipId((prev) => (prev && list.some((c) => c.id === prev) ? prev : list[0].id));
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `projects/${activeProject.id}/clips`)
    );
    return () => unsub();
  }, [fbUser, activeProject]);

  // Upload real video via XHR so we get smooth progress %
  const handleFileUpload = async (file: File) => {
    setBannerError('');
    setBannerSuccess('');
    if (!file.type.startsWith('video/')) {
      setBannerError('Please upload a valid video file (MP4, MOV, or WebM).');
      return;
    }
    setUploading(true);
    setUploadProgress(8);

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', file.name.replace(/\.[^/.]+$/, ''));
    formData.append('language', uploadLanguage);
    formData.append('aspectRatio', uploadRatio);

    try {
      const token = fbUser ? await fbUser.getIdToken() : null;
      const result = await new Promise<{ project: VideoProject }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/videos/upload');
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setUploadProgress(Math.min(95, Math.round((ev.loaded / ev.total) * 95)));
          }
        };
        xhr.onload = () => {
          try {
            const parsed = JSON.parse(xhr.responseText || '{}');
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(parsed);
            } else {
              reject(new Error(parsed.error || 'Upload failed.'));
            }
          } catch {
            reject(new Error('Unexpected upload server response.'));
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload.'));
        xhr.send(formData);
      });

      setUploadProgress(100);

      const savedProject: VideoProject = {
        ...result.project,
        userId: fbUser && fbUser.emailVerified ? fbUser.uid : result.project.userId,
      };

      if (fbUser && fbUser.emailVerified) {
        try {
          await setDoc(doc(db, 'projects', savedProject.id), {
            ...savedProject,
            title: savedProject.title.slice(0, 180),
            transcript: (savedProject.transcript || '').slice(0, 20000),
            viralSummary: (savedProject.viralSummary || '').slice(0, 1000),
            hashtags: (savedProject.hashtags || []).slice(0, 15),
            brollSuggestions: (savedProject.brollSuggestions || []).slice(0, 10),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await updateDoc(doc(db, 'users', fbUser.uid), {
            dailyProjectsUsed: increment(1),
            storageUsedMb: increment(savedProject.fileSizeMb || 0),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `projects/${savedProject.id}`);
        }
      }

      setActiveProject(savedProject);
      setClips([]);
      setActiveClipId(null);
      markTutorialStepDone('step-upload', tutorialActive ? 2 : undefined);
      setBannerSuccess(`Uploaded "${savedProject.title}" (${savedProject.durationSec}s). Ready for AI Auto-Clipping!`);
      setSection('autoclip');
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Video upload failed.');
    } finally {
      setUploading(false);
    }
  };

  // Load 1-Click Sample Creator Video (real FFmpeg MP4)
  const handleLoadSampleVideo = async (preset: 'podcast' | 'gaming') => {
    setBannerError('');
    setBannerSuccess('');
    const sampleId = `sample_${preset}_${Date.now()}`;
    const sampleTitle =
      preset === 'gaming'
        ? 'Anime Boss Dodge Reaction (Sample)'
        : '2026 Creator Podcast Hook Strategy (Sample)';
    const videoUrl = `/api/sample-video/${preset}`;

    const isVerifiedUser = Boolean(fbUser && fbUser.emailVerified);
    const sampleProject: VideoProject = {
      id: sampleId,
      userId: isVerifiedUser ? fbUser!.uid : 'guest_tutorial',
      title: sampleTitle,
      sourceType: 'sample',
      videoUrl,
      durationSec: 18,
      fileSizeMb: 2.4,
      aspectRatio: uploadRatio,
      language: uploadLanguage,
      status: 'uploaded',
      transcript: '',
      viralSummary: '',
      hashtags: [],
      brollSuggestions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isVerifiedUser) {
      try {
        await setDoc(doc(db, 'projects', sampleId), {
          ...sampleProject,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects/${sampleId}`);
      }
    }

    setActiveProject(sampleProject);
    setClips([]);
    setActiveClipId(null);
    markTutorialStepDone('step-upload', tutorialActive ? 2 : undefined);
    setBannerSuccess(`Loaded "${sampleTitle}". Click "Detect Viral Clips with AI" to run Gemini + FFmpeg analysis.`);
    setSection('autoclip');
  };

  // Run AI Auto-Clipping
  const handleRunAutoClip = async () => {
    if (!activeProject) return;
    setBannerError('');
    setBannerSuccess('');
    setAnalyzingAi(true);
    try {
      const token = fbUser ? await fbUser.getIdToken() : null;
      const res = await fetch('/api/ai/auto-clip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectId: activeProject.id,
          videoUrl: activeProject.videoUrl,
          title: activeProject.title,
          language: activeProject.language || uploadLanguage,
          durationSec: activeProject.durationSec,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'AI auto-clipping failed.');

      const transcript = String(data.transcript || '').slice(0, 20000);
      const viralSummary = String(data.viralSummary || '').slice(0, 1000);
      const hashtags = Array.isArray(data.hashtags) ? data.hashtags.map(String).slice(0, 15) : [];
      const brollSuggestions = Array.isArray(data.brollSuggestions)
        ? data.brollSuggestions.map(String).slice(0, 10)
        : [];
      const silenceRanges = Array.isArray(data.silenceRanges) ? data.silenceRanges : [];
      const generatedClips: VideoClip[] = Array.isArray(data.clips) ? data.clips : [];

      const updatedProj: VideoProject = {
        ...activeProject,
        status: 'ready',
        transcript,
        viralSummary,
        hashtags,
        brollSuggestions,
        silenceRanges,
      };
      setActiveProject(updatedProj);
      setClips(generatedClips);
      if (generatedClips[0]) setActiveClipId(generatedClips[0].id);

      if (fbUser && fbUser.emailVerified && activeProject.userId === fbUser.uid) {
        try {
          await updateDoc(doc(db, 'projects', activeProject.id), {
            status: 'ready',
            transcript,
            viralSummary,
            hashtags,
            brollSuggestions,
            silenceRanges,
            updatedAt: serverTimestamp(),
          });

          await Promise.all(
            generatedClips.map((c) =>
              setDoc(doc(db, 'projects', activeProject.id, 'clips', c.id), {
                ...c,
                projectId: activeProject.id,
                userId: fbUser.uid,
                title: c.title.slice(0, 180),
                captions: (c.captions || []).slice(0, 300),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            )
          );

          const userPatch: Record<string, unknown> = {
            dailyMinutesUsed: increment(Math.max(1, Math.round((activeProject.durationSec || 20) / 60))),
            updatedAt: serverTimestamp(),
          };
          if ((userProfile?.credits ?? 0) >= 1) {
            userPatch.credits = increment(-1);
          }
          await updateDoc(doc(db, 'users', fbUser.uid), userPatch);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `projects/${activeProject.id}/clips`);
        }
      }

      markTutorialStepDone('step-autoclip', tutorialActive ? 3 : undefined);
      setBannerSuccess(`Detected ${generatedClips.length} viral short clips with AI scores & synced captions!`);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'AI processing failed.');
    } finally {
      setAnalyzingAi(false);
    }
  };

  // Update active clip locally + persist to Firestore if authenticated
  const handleUpdateClip = async (patch: Partial<VideoClip>) => {
    if (!activeClip || !activeProject) return;
    const updated = { ...activeClip, ...patch };
    setClips((prev) => prev.map((c) => (c.id === activeClip.id ? updated : c)));

    if (
      patch.captionTemplate ||
      patch.fontStyle ||
      patch.captionPosition ||
      patch.captionColor ||
      patch.captionBg
    ) {
      markTutorialStepDone('step-captions');
    }
    if (
      typeof patch.startSec === 'number' ||
      typeof patch.endSec === 'number' ||
      patch.aspectRatio ||
      typeof patch.silenceRemoved === 'boolean' ||
      typeof patch.autoZoom === 'boolean'
    ) {
      markTutorialStepDone('step-editor');
    }

    if (fbUser && fbUser.emailVerified && activeProject.userId === fbUser.uid) {
      try {
        await updateDoc(doc(db, 'projects', activeProject.id, 'clips', activeClip.id), {
          ...patch,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.UPDATE,
          `projects/${activeProject.id}/clips/${activeClip.id}`
        );
      }
    }
  };

  // AI Multilingual Caption Translation
  const handleTranslateCaptions = async (targetLanguage: string, includeEmojis: boolean) => {
    if (!activeClip) return;
    setTranslatingCaptions(true);
    setBannerError('');
    try {
      const token = fbUser ? await fbUser.getIdToken() : null;
      const res = await fetch('/api/ai/captions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          captions: activeClip.captions,
          targetLanguage,
          includeEmojis,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Translation failed.');
      await handleUpdateClip({
        captions: data.captions,
        ...(targetLanguage === 'Hindi' ? { fontStyle: 'hindi' } : {}),
      });
      markTutorialStepDone('step-captions');
      setBannerSuccess(`Captions adapted to ${targetLanguage} with AI keyword highlights.`);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'Caption update failed.');
    } finally {
      setTranslatingCaptions(false);
    }
  };

  // AI Titles, Hashtags & Thumbnail Hook
  const handleGenerateAiMetadata = async (platform: ExportPlatform) => {
    if (!activeClip || !activeProject) return null;
    try {
      const token = fbUser ? await fbUser.getIdToken() : null;
      const res = await fetch('/api/ai/metadata', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          title: activeClip.title,
          transcript: activeProject.transcript || activeClip.captions.map((c) => c.text).join(' '),
          platform,
          language: activeProject.language || 'English',
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  // Real FFmpeg MP4 Export
  const handleExportClip = async (platform: ExportPlatform, resolution: ExportResolution) => {
    if (!activeClip || !activeProject) return;
    setExportingMp4(true);
    setBannerError('');
    setBannerSuccess('');
    try {
      const token = fbUser ? await fbUser.getIdToken() : null;
      const res = await fetch('/api/videos/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          projectId: activeProject.id,
          clipId: activeClip.id,
          videoUrl: activeProject.videoUrl,
          title: activeClip.title,
          startSec: activeClip.startSec,
          endSec: activeClip.endSec,
          aspectRatio: activeClip.aspectRatio,
          resolution,
          platform,
          silenceRemoved: activeClip.silenceRemoved,
          autoZoom: activeClip.autoZoom,
          audioEnhanced: activeClip.audioEnhanced,
          noiseReduced: activeClip.noiseReduced,
          filterName: activeClip.filterName,
          watermarkText: activeClip.watermarkEnabled ? watermarkDraft || userProfile?.watermarkText || '' : '',
          captions: activeClip.captions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Export failed.');

      if (data.exportRecord) {
        if (fbUser && fbUser.emailVerified) {
          try {
            await setDoc(doc(db, 'exports', data.exportRecord.id), {
              ...data.exportRecord,
              userId: fbUser.uid,
              title: String(data.exportRecord.title || 'Clipverse Export').slice(0, 180),
              createdAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `exports/${data.exportRecord.id}`);
          }
        } else {
          setExportsList((prev) => [data.exportRecord, ...prev]);
        }
      }
      markTutorialStepDone('step-export');
      setBannerSuccess(
        `Rendered "${data.exportRecord.title}" (${resolution} MP4, ${data.exportRecord.fileSizeMb} MB). Ready to download in Export History!`
      );
      setSection('exports');
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : 'MP4 export failed.');
    } finally {
      setExportingMp4(false);
    }
  };

  const handleSaveProfileSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser || !fbUser.emailVerified) {
      setAuthModalOpen(true);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', fbUser.uid), {
        displayName: displayNameDraft.trim() || 'Creator',
        watermarkText: watermarkDraft.trim().slice(0, 40),
        preferredLanguage: uploadLanguage,
        updatedAt: serverTimestamp(),
      });
      setBannerSuccess('Profile settings saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${fbUser.uid}`);
      setBannerError('Could not save settings.');
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fbUser || !fbUser.emailVerified) {
      setAuthModalOpen(true);
      return;
    }
    const id = `tkt_${Date.now()}`;
    try {
      await setDoc(doc(db, 'tickets', id), {
        id,
        userId: fbUser.uid,
        userEmail: fbUser.email || '',
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        status: 'open',
        adminReply: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setTicketSubject('');
      setTicketMessage('');
      setBannerSuccess('Support ticket submitted! Our team will respond shortly.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `tickets/${id}`);
      setBannerError('Failed to submit support ticket.');
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!fbUser || !fbUser.emailVerified) return;
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      if (activeProject?.id === projectId) {
        setActiveProject(null);
        setClips([]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
    }
  };

  const navItems: Array<{ id: DashboardSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'welcome', label: 'Welcome', icon: Home },
    { id: 'upload', label: 'Upload Video', icon: UploadCloud },
    { id: 'autoclip', label: 'Auto Clip', icon: Sparkles },
    { id: 'captions', label: 'AI Caption Studio', icon: TypeIcon },
    { id: 'editor', label: 'Video Editor', icon: Sliders },
    { id: 'projects', label: 'My Projects', icon: FolderKanban },
    { id: 'exports', label: 'Export History', icon: Download },
    { id: 'credits', label: 'AI Credits', icon: Coins },
    { id: 'membership', label: 'Membership', icon: Crown },
    { id: 'settings', label: 'Settings', icon: Settings },
    ...(isAdmin ? [{ id: 'admin' as DashboardSection, label: 'Admin Panel', icon: Shield }] : []),
  ];

  const currentPlanDef = plans.find((p) => p.id === userPlan) || MEMBERSHIP_PLANS[0];
  const currentTourStep = TUTORIAL_STEPS[tutorialStepIndex];
  const tourGlow = (selectorKey: string) =>
    tutorialActive && currentTourStep?.highlightSelector.includes(selectorKey)
      ? 'ring-2 ring-blue-500 ring-offset-4 ring-offset-white transition-shadow'
      : '';

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 bg-slate-50/70">
        <div className="h-14 px-5 flex items-center border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setSection('welcome')}
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2"
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-tr from-blue-600 to-sky-400 inline-block" />
            <span>CLIPVERSE AI</span>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Studio navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full min-h-[40px] px-3 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-sm shadow-blue-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Daily Free Quota Meter */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-900">{currentPlanDef.name}</span>
            <span className="font-mono text-blue-600 font-semibold tabular-nums">
              {userProfile?.credits ?? 50} credits
            </span>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500 tabular-nums">
              <span>Daily Projects</span>
              <span>
                {userProfile?.dailyProjectsUsed ?? 0}/{currentPlanDef.dailyProjectsLimit}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round(((userProfile?.dailyProjectsUsed ?? 0) / Math.max(1, currentPlanDef.dailyProjectsLimit)) * 100)
                  )}%`,
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSection('membership')}
            className="w-full py-2 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            {userPlan === 'FREE' ? 'Explore Starter ₹49/wk' : 'Manage Membership'}
          </button>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen pb-20 lg:pb-8">
        {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
        <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSection('welcome')}
              className="lg:hidden font-display text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              CLIPVERSE AI
            </button>
            <span className="hidden lg:inline text-sm font-semibold text-slate-900 truncate">
              {navItems.find((n) => n.id === section)?.label || 'Studio'}
              {activeProject ? ` / ${activeProject.title}` : ''}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-5 text-xs font-medium text-slate-600 shrink-0">
            <button
              type="button"
              onClick={() => {
                setTutorialActive(true);
                setTutorialMinimized(false);
                localStorage.setItem('clipverse_tutorial_dismissed', 'false');
              }}
              className="hover:text-blue-600 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-blue-600" />
              <span>Interactive Tutorial ({completedStepIds.length}/{TUTORIAL_STEPS.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSection('membership')}
              className="hover:text-blue-600 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Plans from ₹49
            </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {fbUser ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs font-medium text-slate-700 max-w-[140px] truncate">
                  {userProfile?.displayName || fbUser.displayName || fbUser.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut(auth)}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="min-h-[38px] px-4 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm shadow-blue-600/20 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </header>

        {/* Global Error / Success Banners */}
        <div className="px-4 sm:px-6 lg:px-8 pt-4 space-y-2 max-w-7xl w-full mx-auto">
          {bannerError && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bannerError}</span>
              </div>
              <button type="button" onClick={() => setBannerError('')} className="p-1 hover:bg-red-100 rounded cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {bannerSuccess && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs text-emerald-700">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{bannerSuccess}</span>
              </div>
              <button type="button" onClick={() => setBannerSuccess('')} className="p-1 hover:bg-emerald-100 rounded cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Viewport Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {/* 1. WELCOME SCREEN */}
              {section === 'welcome' && (
                <div className="space-y-8">
                  <div
                    data-tour="welcome-hero"
                    className={`rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-white to-blue-50/70 overflow-hidden ${tourGlow(
                      'welcome-hero'
                    )}`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                      <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center space-y-5">
                        <div className="text-xs font-semibold text-blue-600">
                          Free-First AI Clipping Studio · 10 Daily Projects · Zero Forced Watermark
                        </div>
                        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight [text-wrap:balance]">
                          Turn Long Videos Into Viral Shorts &amp; Reels in Seconds
                        </h1>
                        <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
                          Upload podcasts, gaming streams, or tutorials. Gemini AI scores viral hooks, writes Hindi &amp; English karaoke captions with 108 anime styles, and FFmpeg exports crisp 1080p MP4s for free.
                        </p>
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => setSection('upload')}
                            className="min-h-[44px] px-6 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer"
                          >
                            <UploadCloud className="w-4 h-4" />
                            <span>Upload Video</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTutorialActive(true);
                              setTutorialMinimized(false);
                              setTutorialStepIndex(1);
                              setSection('upload');
                            }}
                            className="min-h-[44px] px-5 rounded-xl border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-sm font-semibold flex items-center gap-2 cursor-pointer"
                          >
                            <Compass className="w-4 h-4" />
                            <span>Start Interactive Tutorial</span>
                          </button>
                        </div>
                      </div>

                      <div className="lg:col-span-5 min-h-[240px] lg:min-h-full relative bg-blue-50">
                        <img
                          src="/src/assets/images/anime_mascot_hero_1794746973965.jpg"
                          alt="CLIPVERSE AI Anime Studio Director"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Free Plan KPI Strip */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Free Daily Projects', value: '10 / day', sub: 'Reset every 24h' },
                      { label: 'Daily Processing', value: '30 min', sub: 'Real FFmpeg + AI' },
                      { label: 'Free Caption Styles', value: '24+ Styles', sub: '108 total in Studio' },
                      { label: 'Free Export Quality', value: '1080p MP4', sub: 'No forced watermark' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs text-slate-500">{stat.label}</div>
                        <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                          {stat.value}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{stat.sub}</div>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Tutorial Quest Checklist + Sample Starters */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-bold text-slate-900">
                            Interactive Onboarding Quests
                          </h2>
                          <p className="text-xs text-slate-500">
                            Follow all 6 guided hands-on steps to master CLIPVERSE AI
                          </p>
                        </div>
                        <span className="font-mono text-xs font-semibold text-blue-600 tabular-nums">
                          {completedStepIds.length}/{TUTORIAL_STEPS.length} done
                        </span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {TUTORIAL_STEPS.map((st, idx) => {
                          const done = completedStepIds.includes(st.id);
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setTutorialActive(true);
                                setTutorialMinimized(false);
                                setTutorialStepIndex(idx);
                                setSection(st.targetSection);
                              }}
                              className="w-full py-3 flex items-center justify-between gap-3 text-left hover:bg-slate-50/70 px-2 rounded-lg transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <CheckCircle2
                                  className={`w-4 h-4 shrink-0 ${
                                    done ? 'text-emerald-600' : 'text-slate-300'
                                  }`}
                                />
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {st.stepNumber}. {st.title}
                                  </div>
                                  <div className="text-[11px] text-slate-500 truncate">{st.subtitle}</div>
                                </div>
                              </div>
                              <span className="text-[11px] font-semibold text-blue-600 whitespace-nowrap shrink-0">
                                {done ? 'Review' : 'Start →'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                      <div>
                        <h2 className="text-base font-bold text-slate-900">1-Click Tutorial Samples</h2>
                        <p className="text-xs text-slate-500">
                          Try real AI clipping immediately with our studio-rendered sample MP4s
                        </p>
                      </div>

                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() => handleLoadSampleVideo('podcast')}
                          className="w-full rounded-xl border border-slate-200 hover:border-blue-500 overflow-hidden text-left transition-all cursor-pointer group"
                        >
                          <div className="aspect-video relative bg-slate-100 overflow-hidden">
                            <img
                              src="/src/assets/images/anime_clip_preview_thumb_1794746975714.jpg"
                              alt="Creator Podcast Sample"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent flex items-end p-3">
                              <div className="text-white">
                                <div className="text-xs font-bold">Creator Podcast Hook Strategy</div>
                                <div className="text-[11px] text-sky-300">18s · Spoken AI Audio · Load Sample →</div>
                              </div>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleLoadSampleVideo('gaming')}
                          className="w-full rounded-xl border border-slate-200 hover:border-blue-500 overflow-hidden text-left transition-all cursor-pointer group"
                        >
                          <div className="aspect-video relative bg-slate-100 overflow-hidden">
                            <img
                              src="/src/assets/images/anime_gaming_thumb_1794746977974.jpg"
                              alt="Gaming Reaction Sample"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent flex items-end p-3">
                              <div className="text-white">
                                <div className="text-xs font-bold">Anime Boss Dodge Clutch Reaction</div>
                                <div className="text-[11px] text-sky-300">18s · High-Energy Audio · Load Sample →</div>
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. UPLOAD VIDEO */}
              {section === 'upload' && (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">Upload Source Video</h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Drag and drop MP4, MOV, or WebM files up to 250 MB, or launch a sample creator video to test AI clipping.
                    </p>
                  </div>

                  {/* Pre-upload AI Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Primary Speech &amp; Caption Language
                      </label>
                      <select
                        value={uploadLanguage}
                        onChange={(e) => setUploadLanguage(e.target.value)}
                        className="w-full min-h-[40px] rounded-xl border border-slate-200 px-3 text-xs font-medium text-slate-800 outline-none focus:border-blue-600"
                      >
                        <option value="English">English</option>
                        <option value="Hindi">Hindi (हिन्दी)</option>
                        <option value="Hinglish">Hinglish (Hindi + English)</option>
                        <option value="Spanish">Spanish</option>
                        <option value="Japanese">Japanese (日本語)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Target Output Aspect Ratio
                      </label>
                      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                        {(['9:16', '16:9', '1:1'] as AspectRatio[]).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setUploadRatio(r)}
                            className={`py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
                              uploadRatio === r
                                ? 'bg-white text-blue-600 shadow-sm'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Seamless Drag-and-Drop Dropzone */}
                  <div
                    data-tour="upload-dropzone"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-3xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-blue-600 bg-blue-50/80'
                        : 'border-slate-300 bg-slate-50/60 hover:border-blue-400 hover:bg-blue-50/30'
                    } ${tourGlow('upload-dropzone')}`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="video/mp4,video/quicktime,video/webm,video/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                    <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-blue-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-blue-600/20 mb-4">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900">
                      {uploading ? 'Uploading & Analyzing Video Stream...' : 'Drop your video here, or click to browse'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Supports MP4, MOV, WebM · Real FFprobe duration &amp; silence detection
                    </p>

                    {uploading && (
                      <div className="max-w-sm mx-auto mt-5 space-y-1.5">
                        <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all duration-200"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                        <div className="text-xs font-mono text-blue-600 tabular-nums">
                          {uploadProgress}% uploaded
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sample Quick-Start Buttons */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">No video handy right now?</h3>
                      <p className="text-xs text-slate-500">
                        Load a studio-rendered sample MP4 with spoken audio to experience the full pipeline.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadSampleVideo('podcast')}
                        className="min-h-[40px] px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold cursor-pointer"
                      >
                        Load Podcast Sample
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadSampleVideo('gaming')}
                        className="min-h-[40px] px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Load Gaming Sample
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. AI AUTO CLIP */}
              {section === 'autoclip' && (
                <div className="space-y-6">
                  {!activeProject ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
                      <Scissors className="w-10 h-10 text-blue-600 mx-auto" />
                      <h2 className="text-lg font-bold text-slate-900">No Active Video Loaded</h2>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Upload your own video or load a 1-click tutorial sample to run Gemini AI viral highlight detection.
                      </p>
                      <div className="flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSection('upload')}
                          className="min-h-[42px] px-5 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Go to Upload Video
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLoadSampleVideo('podcast')}
                          className="min-h-[42px] px-5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
                        >
                          Load Sample Video
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        data-tour="autoclip-trigger"
                        className={`rounded-2xl border border-slate-200 bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${tourGlow(
                          'autoclip-trigger'
                        )}`}
                      >
                        <div className="space-y-1">
                          <div className="text-xs text-slate-500 tabular-nums">
                            {activeProject.language} · {activeProject.durationSec}s · {activeProject.fileSizeMb} MB
                          </div>
                          <h2 className="text-lg font-bold text-slate-900">{activeProject.title}</h2>
                          {activeProject.viralSummary && (
                            <p className="text-xs text-slate-600 max-w-2xl">{activeProject.viralSummary}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={analyzingAi}
                          onClick={handleRunAutoClip}
                          className="min-h-[44px] px-6 rounded-xl bg-gradient-to-r from-blue-600 to-sky-500 hover:from-blue-700 hover:to-sky-600 text-white text-sm font-semibold flex items-center gap-2 shadow-md shadow-blue-600/20 disabled:opacity-60 shrink-0 cursor-pointer"
                        >
                          <Sparkles className={`w-4 h-4 ${analyzingAi ? 'animate-spin' : ''}`} />
                          <span>
                            {analyzingAi
                              ? 'Transcribing & Scoring Viral Clips...'
                              : clips.length > 0
                              ? 'Re-Run AI Viral Detection'
                              : 'Detect Viral Clips with AI'}
                          </span>
                        </button>
                      </div>

                      {/* Source Video Preview + Transcript */}
                      {clips.length === 0 ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-slate-950 overflow-hidden aspect-video">
                            <video
                              src={activeProject.videoUrl}
                              controls
                              playsInline
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                            <h3 className="text-sm font-bold text-slate-900">What AI Auto-Clip Does</h3>
                            <ul className="space-y-2 text-xs text-slate-600">
                              <li>1. Extracts audio with FFmpeg &amp; runs silence gap detection.</li>
                              <li>2. Transcribes speech via Gemini 3.5 Transcribe.</li>
                              <li>3. Scores hooks, humor, reactions, and emotional peaks (0–99).</li>
                              <li>4. Builds word-synced captions &amp; thumbnail frames.</li>
                            </ul>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900">
                              AI-Detected Viral Clips ({clips.length})
                            </h3>
                            {activeProject.transcript && (
                              <span className="text-xs text-slate-500 truncate max-w-md">
                                Transcript: &ldquo;{activeProject.transcript.slice(0, 90)}...&rdquo;
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {clips.map((c) => (
                              <div
                                key={c.id}
                                className={`rounded-2xl border bg-white overflow-hidden flex flex-col justify-between transition-all ${
                                  activeClipId === c.id
                                    ? 'border-blue-600 ring-2 ring-blue-600/15'
                                    : 'border-slate-200 hover:border-blue-300'
                                }`}
                              >
                                <div>
                                  <div className="aspect-video bg-slate-950 relative overflow-hidden">
                                    <img
                                      src={
                                        c.thumbnailUrl ||
                                        '/src/assets/images/anime_clip_preview_thumb_1794746975714.jpg'
                                      }
                                      alt={c.title}
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-transparent flex items-end justify-between p-3 text-white">
                                      <span className="text-xs font-mono tabular-nums">
                                        {c.startSec.toFixed(1)}s – {c.endSec.toFixed(1)}s
                                      </span>
                                      <span className="text-sm font-extrabold font-mono text-sky-300 tabular-nums">
                                        Viral {c.viralScore}/100
                                      </span>
                                    </div>
                                  </div>

                                  <div className="p-4 space-y-1.5">
                                    <div className="text-[11px] font-semibold text-blue-600">
                                      {c.category} · {(c.endSec - c.startSec).toFixed(1)}s clip
                                    </div>
                                    <h4 className="text-sm font-bold text-slate-900">{c.title}</h4>
                                    <p className="text-xs text-slate-600 leading-relaxed">{c.reason}</p>
                                  </div>
                                </div>

                                <div className="px-4 pb-4 pt-2 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveClipId(c.id);
                                      setSection('captions');
                                    }}
                                    className="flex-1 min-h-[38px] rounded-xl border border-slate-200 hover:border-blue-500 text-xs font-semibold text-slate-800 cursor-pointer"
                                  >
                                    Caption Studio
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveClipId(c.id);
                                      setSection('editor');
                                    }}
                                    className="flex-1 min-h-[38px] rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Edit &amp; Export
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 4. AI CAPTION STUDIO */}
              {section === 'captions' && (
                <div>
                  {!activeProject || !activeClip ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
                      <TypeIcon className="w-10 h-10 text-blue-600 mx-auto" />
                      <h2 className="text-lg font-bold text-slate-900">Select or Generate a Clip First</h2>
                      <p className="text-xs text-slate-500">
                        Run AI Auto-Clipping on a video so you can style 108+ caption templates live.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSection('autoclip')}
                        className="min-h-[40px] px-5 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Open Auto Clip
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {activeClip.title}
                          </span>
                          <span className="text-xs font-mono text-blue-600 tabular-nums shrink-0">
                            Score {activeClip.viralScore}
                          </span>
                        </div>
                        <VideoPreviewPlayer
                          videoUrl={activeProject.videoUrl}
                          clip={activeClip}
                          customWatermarkText={watermarkDraft || userProfile?.watermarkText}
                        />
                        {clips.length > 1 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                            {clips.map((c, idx) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => setActiveClipId(c.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                                  c.id === activeClip.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                Clip #{idx + 1} ({c.viralScore})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className={`lg:col-span-8 ${tourGlow('caption-studio-panel')}`}>
                        <CaptionStudio
                          clip={activeClip}
                          userPlan={userPlan}
                          onUpdateClip={handleUpdateClip}
                          onTranslateCaptions={handleTranslateCaptions}
                          translating={translatingCaptions}
                          onRequestUpgrade={() => setSection('membership')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 5. VIDEO EDITOR */}
              {section === 'editor' && (
                <div>
                  {!activeProject || !activeClip ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
                      <Sliders className="w-10 h-10 text-blue-600 mx-auto" />
                      <h2 className="text-lg font-bold text-slate-900">Load a Clip to Edit &amp; Export</h2>
                      <p className="text-xs text-slate-500">
                        Upload a video or run AI Auto-Clip on a sample video to enter the Video Editor.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSection('upload')}
                        className="min-h-[40px] px-5 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                      >
                        Upload or Load Sample
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      <div className="lg:col-span-4 lg:sticky lg:top-20 space-y-3">
                        <VideoPreviewPlayer
                          videoUrl={activeProject.videoUrl}
                          clip={activeClip}
                          customWatermarkText={watermarkDraft || userProfile?.watermarkText}
                        />
                      </div>
                      <div className={`lg:col-span-8 ${tourGlow('editor-controls')}`}>
                        <VideoEditorPanel
                          clip={activeClip}
                          projectDurationSec={activeProject.durationSec}
                          transcript={activeProject.transcript}
                          brollSuggestions={activeProject.brollSuggestions || []}
                          userPlan={userPlan}
                          customWatermarkText={watermarkDraft}
                          onUpdateClip={handleUpdateClip}
                          onUpdateWatermarkText={setWatermarkDraft}
                          onExportClip={handleExportClip}
                          onGenerateAiMetadata={handleGenerateAiMetadata}
                          exporting={exportingMp4}
                          onRequestUpgrade={() => setSection('membership')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 6. MY PROJECTS */}
              {section === 'projects' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-slate-900">My Projects</h1>
                      <p className="text-xs text-slate-500">
                        {fbUser
                          ? 'Synced with Cloud Firestore across your devices.'
                          : 'Sign in with Google or Email to permanently save your video projects.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('upload')}
                      className="min-h-[40px] px-4 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                    >
                      New Project
                    </button>
                  </div>

                  {projects.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
                      <FolderKanban className="w-10 h-10 text-slate-300 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-900">No Saved Projects Yet</h3>
                      <p className="text-xs text-slate-500">
                        Upload a video or try a sample project to build your first AI clip collection.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map((pr) => (
                        <div key={pr.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold text-slate-900 truncate">{pr.title}</h3>
                              <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                                {pr.durationSec}s · {pr.language} · {pr.status}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteProject(pr.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                              aria-label="Delete project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveProject(pr);
                                setSection('autoclip');
                              }}
                              className="flex-1 min-h-[36px] rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Open Studio</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 7. EXPORT HISTORY */}
              {section === 'exports' && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">Export History</h1>
                    <p className="text-xs text-slate-500">
                      Download your FFmpeg-rendered MP4 shorts ready for YouTube, Instagram, Facebook, TikTok, and WhatsApp.
                    </p>
                  </div>

                  {exportsList.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
                      <Download className="w-10 h-10 text-slate-300 mx-auto" />
                      <h3 className="text-sm font-bold text-slate-900">No MP4 Exports Yet</h3>
                      <p className="text-xs text-slate-500">
                        Open any clip in the Video Editor and click &ldquo;Render &amp; Export MP4&rdquo;.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="px-4 py-3 font-medium">Clip Title</th>
                            <th className="px-4 py-3 font-medium">Platform</th>
                            <th className="px-4 py-3 font-medium">Quality</th>
                            <th className="px-4 py-3 font-medium">Size</th>
                            <th className="px-4 py-3 font-medium text-right">Download</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {exportsList.map((exp) => (
                            <tr key={exp.id}>
                              <td className="px-4 py-3 font-semibold text-slate-900">{exp.title}</td>
                              <td className="px-4 py-3 text-slate-600">{exp.platform}</td>
                              <td className="px-4 py-3 font-mono tabular-nums">
                                {exp.resolution} · {exp.aspectRatio}
                              </td>
                              <td className="px-4 py-3 font-mono tabular-nums">{exp.fileSizeMb} MB</td>
                              <td className="px-4 py-3 text-right">
                                <a
                                  href={exp.fileUrl}
                                  download={`clipverse_${exp.id}.mp4`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Download MP4</span>
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 8. AI CREDITS */}
              {section === 'credits' && (
                <div className="max-w-4xl space-y-6">
                  <div>
                    <h1 className="text-xl font-bold text-slate-900">AI Credits &amp; Daily Usage</h1>
                    <p className="text-xs text-slate-500">
                      Free creators receive generous daily resets without needing a credit card.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs text-slate-500">Available AI Credits</div>
                      <div className="text-3xl font-extrabold font-mono text-blue-600 tabular-nums mt-1">
                        {userProfile?.credits ?? 50}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">1 credit per AI auto-clip run</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs text-slate-500">Daily Projects Used</div>
                      <div className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums mt-1">
                        {userProfile?.dailyProjectsUsed ?? 0} / {currentPlanDef.dailyProjectsLimit}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">Resets daily</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="text-xs text-slate-500">Cloud Storage Used</div>
                      <div className="text-3xl font-extrabold font-mono text-slate-900 tabular-nums mt-1">
                        {(userProfile?.storageUsedMb ?? 0).toFixed(1)} MB
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Out of {currentPlanDef.storageGb} GB ({currentPlanDef.name})
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. MEMBERSHIP & UPI */}
              {section === 'membership' && (
                <MembershipUpiPanel
                  plans={plans}
                  userProfile={userProfile}
                  payments={payments}
                  authToken={authToken}
                  onRequireAuth={() => setAuthModalOpen(true)}
                  onPaymentCreated={() => {
                    if (fbUser) syncUserProfile(fbUser);
                  }}
                />
              )}

              {/* 10. SETTINGS, SUPPORT & ANDROID APK GUIDE */}
              {section === 'settings' && (
                <div className="max-w-4xl space-y-6">
                  <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
                    {[
                      { id: 'account', label: 'Account & Branding' },
                      { id: 'support', label: 'Support Tickets' },
                      { id: 'android', label: 'Android APK & Deployment' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSettingsTab(t.id as 'account' | 'support' | 'android')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          settingsTab === t.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {settingsTab === 'account' && (
                    <form
                      onSubmit={handleSaveProfileSettings}
                      className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
                    >
                      <h2 className="text-base font-bold text-slate-900">Creator Profile &amp; Defaults</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">Display Name</label>
                          <input
                            type="text"
                            value={displayNameDraft}
                            onChange={(e) => setDisplayNameDraft(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-600"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Optional Channel Watermark
                          </label>
                          <input
                            type="text"
                            value={watermarkDraft}
                            onChange={(e) => setWatermarkDraft(e.target.value)}
                            placeholder="@YourHandle (leave blank for clean exports)"
                            className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-600"
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="min-h-[42px] px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        Save Account Settings
                      </button>
                    </form>
                  )}

                  {settingsTab === 'support' && (
                    <div className="space-y-5">
                      <form
                        onSubmit={handleSubmitTicket}
                        className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4"
                      >
                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-blue-600" />
                          <span>Submit Support Ticket</span>
                        </h2>
                        <input
                          type="text"
                          required
                          value={ticketSubject}
                          onChange={(e) => setTicketSubject(e.target.value)}
                          placeholder="Subject (e.g. UPI payment reference check or export question)"
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-600"
                        />
                        <textarea
                          required
                          rows={3}
                          value={ticketMessage}
                          onChange={(e) => setTicketMessage(e.target.value)}
                          placeholder="Describe how we can help..."
                          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-blue-600"
                        />
                        <button
                          type="submit"
                          className="min-h-[42px] px-5 rounded-xl bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Submit Ticket
                        </button>
                      </form>

                      {tickets.length > 0 && (
                        <div className="space-y-2.5">
                          {tickets.map((tk) => (
                            <div key={tk.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-900">{tk.subject}</span>
                                <span className="capitalize font-semibold text-blue-600">{tk.status}</span>
                              </div>
                              <p className="text-xs text-slate-600">{tk.message}</p>
                              {tk.adminReply && (
                                <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-2 mt-1">
                                  Admin Reply: {tk.adminReply}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {settingsTab === 'android' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Smartphone className="w-4 h-4 text-blue-600" />
                          <span>Android APK Build (Capacitor)</span>
                        </h3>
                        <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 rounded-xl p-3.5 overflow-x-auto leading-relaxed">
{`npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "CLIPVERSE AI" "ai.clipverse.app" --web-dir=dist
npx cap add android
npx cap sync android
cd android && ./gradlew assembleRelease`}
                        </pre>
                        <p className="text-xs text-slate-600">
                          Point <code className="font-mono">server.url</code> in <code className="font-mono">capacitor.config.ts</code> to your deployed Cloud Run URL so FFmpeg and Gemini API calls route securely.
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Server className="w-4 h-4 text-blue-600" />
                          <span>Production Web Deployment</span>
                        </h3>
                        <pre className="text-[11px] font-mono bg-slate-950 text-slate-100 rounded-xl p-3.5 overflow-x-auto leading-relaxed">
{`# Install dependencies & build Vite bundle
npm install
npm run build

# Ensure ffmpeg is installed on container/host
apt-get install -y ffmpeg

# Start production Express + API server on port 3000
GEMINI_API_KEY=... npm start`}
                        </pre>
                        <p className="text-xs text-slate-600">
                          Firestore security rules (<code className="font-mono">firestore.rules</code>) are pre-deployed and enforce owner-only access and admin payment reconciliation.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 11. ADMIN PANEL */}
              {section === 'admin' && isAdmin && (
                <AdminPanel
                  plans={plans}
                  onPlansUpdated={fetchPlans}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Thumb-Zone Navigation <= 15% viewport height) */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center"
        aria-label="Mobile navigation"
      >
        {[
          { id: 'welcome' as DashboardSection, label: 'Home', icon: Home },
          { id: 'upload' as DashboardSection, label: 'Upload', icon: UploadCloud },
          { id: 'autoclip' as DashboardSection, label: 'Auto Clip', icon: Sparkles },
          { id: 'editor' as DashboardSection, label: 'Editor', icon: Sliders },
        ].map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                setMobileMenuOpen(false);
              }}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                active ? 'text-blue-600' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold tracking-tight">{item.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            mobileMenuOpen ? 'text-blue-600' : 'text-slate-500'
          }`}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-semibold tracking-tight">More</span>
        </button>
      </nav>

      {/* Mobile More Drawer */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-xs flex items-end"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-5 pb-8 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-2" />
            <div className="grid grid-cols-2 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSection(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                      section === item.id
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setTutorialActive(true);
                  setTutorialMinimized(false);
                  setMobileMenuOpen(false);
                }}
                className="min-h-[44px] px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Compass className="w-4 h-4 shrink-0" />
                <span>Tutorial Guide</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Tutorial & Onboarding Coach */}
      <TutorialOverlay
        active={tutorialActive}
        minimized={tutorialMinimized}
        currentStepIndex={tutorialStepIndex}
        completedStepIds={completedStepIds}
        onSetMinimized={setTutorialMinimized}
        onSelectStep={(idx, target) => {
          setTutorialStepIndex(idx);
          localStorage.setItem('clipverse_tutorial_step', String(idx));
          setSection(target);
        }}
        onComplete={() => {
          markTutorialStepDone('step-export');
          setTutorialActive(false);
          localStorage.setItem('clipverse_tutorial_dismissed', 'true');
          if (fbUser && fbUser.emailVerified) {
            updateDoc(doc(db, 'users', fbUser.uid), {
              tutorialCompleted: true,
              tutorialStep: TUTORIAL_STEPS.length,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
          setBannerSuccess('Interactive Tutorial completed! You are ready to create unlimited free AI clips.');
        }}
        onDismiss={() => {
          setTutorialActive(false);
          localStorage.setItem('clipverse_tutorial_dismissed', 'true');
        }}
      />

      {/* Sign In / Sign Up / Password Recovery Modal */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
