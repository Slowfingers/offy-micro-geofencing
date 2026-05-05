import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  MapPin,
  Tag,
  Bell,
  Sparkles,
  Navigation,
  ChevronRight,
  Clock,
  Share2,
  Heart,
  X,
  Languages,
  ShoppingBag,
  Smartphone,
  Utensils,
  Flame,
  Zap,
  Map as MapIcon,
  Trophy,
  Award,
  Star,
  TrendingUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

// Types
interface Discount {
  id: string;
  store: string;
  discountAmount: string;
  title: string;
  description: string;
  category: string;
  validUntil: string | null;
  image: string;
  source: string;
  createdAt: string;
  isNearby?: boolean;
}

interface UserStats {
  xp: number;
  level: number;
  streak: number;
  lastVisit: string;
  savedCount: number;
  sharedCount: number;
}

const CATEGORIES = [
  { name: "All", icon: Sparkles, ru: "Все", uz: "Barchasi" },
  { name: "Clothing", icon: ShoppingBag, ru: "Одежда", uz: "Kiyim-kechak" },
  { name: "Food", icon: Utensils, ru: "Еда", uz: "Oziq-ovqat" },
  { name: "Electronics", icon: Smartphone, ru: "Техника", uz: "Texnika" },
  { name: "Beauty", icon: Sparkles, ru: "Красота", uz: "Go'zallik" },
  { name: "Other", icon: Tag, ru: "Прочее", uz: "Boshqa" },
];

const TRANSLATIONS = {
  ru: {
    search: "Поиск скидок и брендов...",
    nearby: "Рядом с вами",
    featured: "Популярное",
    allDeals: "Все предложения",
    refresh: "Обновить",
    locating: "Определяем локацию...",
    noResults: "Ничего не найдено",
    openInTelegram: "Открыть в Telegram",
    expires: "До",
    justNow: "Только что",
    minsAgo: "мин. назад",
    about: "О предложении",
    limited: "Ограниченное время",
    details: "Подробнее",
    saved: "Сохраненное",
    feed: "Лента",
    favorites: "Избранное",
    noFavorites: "У вас пока нет сохраненных скидок",
    distance: "Дистанция",
    validUntil: "Срок действия",
    limitedOffer: "Ограниченное предложение",
    added: "Добавлено",
    validUntilLabel: "Истекает"
  },
  uz: {
    search: "Chegirmalar va brendlarni qidirish...",
    nearby: "Yaqin atrofda",
    featured: "Ommabop",
    allDeals: "Barcha takliflar",
    refresh: "Yangilash",
    locating: "Joylashuv aniqlanmoqda...",
    noResults: "Hech narsa topilmadi",
    openInTelegram: "Telegramda ochish",
    expires: "Gacha",
    justNow: "Hozirgina",
    minsAgo: "daqiqa oldin",
    about: "Taklif haqida",
    limited: "Cheklangan vaqt",
    details: "Batafsil",
    saved: "Saqlangan",
    feed: "Lenta",
    favorites: "Saqlanganlar",
    noFavorites: "Sizda hozircha saqlangan chegirmalar yo'q",
    distance: "Masofa",
    validUntil: "Amal qilish muddati",
    limitedOffer: "Cheklangan taklif",
    added: "Qo'shilgan",
    validUntilLabel: "Tugash vaqti"
  }
};

export default function App() {
  const [lang, setLang] = useState<"ru" | "uz">("ru");
  const [viewMode, setViewMode] = useState<"feed" | "favorites">("feed");
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showMapModal, setShowMapModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [stats, setStats] = useState<UserStats>({
    xp: 0,
    level: 1,
    streak: 0,
    lastVisit: "",
    savedCount: 0,
    sharedCount: 0
  });

  const t = TRANSLATIONS[lang];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  useEffect(() => {
    loadDiscounts();
    backgroundSync();
    requestLocation();
    const savedFavs = localStorage.getItem("favorites");
    if (savedFavs) setFavorites(new Set(JSON.parse(savedFavs)));
    
    // Gamification Init
    const savedStats = localStorage.getItem("userStats");
    if (savedStats) {
      setStats(JSON.parse(savedStats));
    }
  }, [lang]);

  // Daily Login Check
  useEffect(() => {
    const today = new Date().toDateString();
    if (stats.lastVisit !== today && stats.lastVisit !== "") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      let newStreak = stats.streak;
      if (stats.lastVisit === yesterday.toDateString()) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
      
      awardXp(50, lang === 'ru' ? 'Ежедневный вход!' : 'Kundalik tashrif!', { streak: newStreak, lastVisit: today });
    } else if (stats.lastVisit === "") {
      // First time ever
      awardXp(50, lang === 'ru' ? 'Добро пожаловать!' : 'Xush kelibsiz!', { streak: 1, lastVisit: today });
    }
  }, [stats.lastVisit]);

  const awardXp = (amount: number, reason: string, extraUpdates: Partial<UserStats> = {}) => {
    setStats(prev => {
      const newXp = prev.xp + amount;
      const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
      
      if (newLevel > prev.level) {
        toast.success(`🎉 ${lang === 'ru' ? 'Новый уровень!' : 'Yangi daraja!'} (Level ${newLevel})`);
      } else {
        toast.success(`+${amount} XP: ${reason}`);
      }
      
      const updated = { ...prev, ...extraUpdates, xp: newXp, level: newLevel };
      localStorage.setItem('userStats', JSON.stringify(updated));
      return updated;
    });
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavs = new Set(favorites);
    if (newFavs.has(id)) {
      newFavs.delete(id);
    } else {
      newFavs.add(id);
      awardXp(10, lang === 'ru' ? 'Скидка сохранена!' : 'Chegirma saqlandi!', { savedCount: stats.savedCount + 1 });
    }
    setFavorites(newFavs);
    localStorage.setItem("favorites", JSON.stringify(Array.from(newFavs)));
  };

  const loadDiscounts = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/discounts");
      const data: Discount[] = await response.json();
      
      if (data.length === 0) {
        setDiscounts(getMockData(lang));
      } else {
        setDiscounts(data.map(d => ({ ...d, isNearby: Math.random() > 0.7 })));
      }
    } catch (error) {
      console.error("Fetch error:", error);
      setDiscounts(getMockData(lang));
    } finally {
      setLoading(false);
    }
  };

  const backgroundSync = async () => {
    try {
      const configRes = await fetch("/api/config");
      const config = await configRes.json();
      const lastSync = config.lastSync ? new Date(config.lastSync).getTime() : 0;
      const oneHour = 1 * 60 * 60 * 1000;

      if (Date.now() - lastSync > oneHour) {
        setIsSyncing(true);
        
        console.log("Using fallback scraper directly...");
        await fetch("/api/scrape-fallback", { method: "POST" });
        
        // Update sync time
        await fetch("/api/update-sync-time", { method: "POST" });

        // Silently reload discounts after saving
        const response = await fetch("/api/discounts");
        const data: Discount[] = await response.json();
        if (data.length > 0) {
          setDiscounts(data.map(d => ({ ...d, isNearby: Math.random() > 0.7 })));
        }
      }
    } catch (error) {
      console.error("Background sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const getMockData = (l: string): Discount[] => [
    {
      id: "m1",
      store: "Terra Pro",
      discountAmount: "50%",
      title: "Winter Sale",
      description: l === "ru" ? "Сезонная распродажа зимней коллекции." : "Qishki kolleksiyada mavsumiy chegirmalar.",
      category: "Clothing",
      validUntil: "30.04.2026",
      image: "https://picsum.photos/seed/terra/600/400",
      source: "https://t.me/terrapro",
      createdAt: new Date().toISOString(),
      isNearby: true
    },
    {
      id: "m2",
      store: "Korzinka",
      discountAmount: "20%",
      title: "Holiday Deals",
      description: l === "ru" ? "Скидки на продукты к празднику." : "Bayram munosabati bilan mahsulotlarga chegirmalar.",
      category: "Food",
      validUntil: "15.04.2026",
      image: "https://picsum.photos/seed/korzinka/600/400",
      source: "https://t.me/korzinkauz",
      createdAt: new Date().toISOString(),
      isNearby: false
    }
  ];

  const requestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.error(err)
      );
    }
  };

  const filteredDiscounts = useMemo(() => {
    let result = discounts;
    if (viewMode === "favorites") {
      result = result.filter(d => favorites.has(d.id));
    }
    return result.filter(d => {
      const matchesSearch = d.store.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           d.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           d.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === "All" || d.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [discounts, searchQuery, activeCategory, viewMode, favorites]);

  const nearbyDiscounts = useMemo(() => discounts.filter(d => d.isNearby).slice(0, 4), [discounts]);

  return (
    <div className="min-h-screen bg-surface selection:bg-primary/20 pb-24 sm:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-white/20">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/30 rotate-[-6deg] transform transition-transform hover:rotate-0 relative">
              <Zap size={24} strokeWidth={2.5} fill="currentColor" />
              {isSyncing && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white border-2 border-primary"></span>
                </span>
              )}
            </div>
            <div className="hidden sm:block">
              <h1 className="text-2xl font-display font-black tracking-tight leading-none">SaleSpotter</h1>
              <p className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase mt-1 flex items-center gap-1">
                Uzbekistan
                {isSyncing && <span className="text-slate-400 italic normal-case tracking-normal">({lang === 'ru' ? 'обновляем...' : 'yangilanmoqda...'})</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setLang(lang === "ru" ? "uz" : "ru")}
              className="rounded-xl hover:bg-white/50 bg-white/30"
            >
              <Languages size={20} className="text-slate-700" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowProfileModal(true)}
              className="hidden sm:flex rounded-xl hover:bg-white/50 bg-white/30 transition-colors"
            >
              <Trophy size={20} className="text-amber-500" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setShowMapModal(true)}
              className="hidden sm:flex rounded-xl hover:bg-white/50 bg-white/30 transition-colors"
            >
              <MapIcon size={20} className="text-slate-700" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode(viewMode === "feed" ? "favorites" : "feed")}
              className={cn("hidden sm:flex rounded-xl hover:bg-white/50 bg-white/30 transition-colors", viewMode === "favorites" && "bg-white/60")}
            >
              <Heart size={20} className={cn(viewMode === "favorites" ? "fill-primary text-primary" : "text-slate-700")} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-xl hover:bg-white/50 bg-white/30 relative"
              onClick={() => toast.success(lang === 'ru' ? 'Уведомления включены!' : 'Bildirishnomalar yoqildi!')}
            >
              <Bell size={20} className="text-slate-700" />
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-primary rounded-full border-2 border-white animate-pulse" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-12">
        {/* Hero & Search */}
        <section className="space-y-8 text-center pt-4">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-6xl font-display font-black tracking-tight">
              {lang === 'ru' ? 'Найди свою ' : 'O\'z '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                {lang === 'ru' ? 'выгоду' : 'foydangizni'}
              </span>
              {lang === 'ru' ? ' сегодня' : ' toping'}
            </h2>
            <p className="text-slate-500 font-medium text-lg max-w-xl mx-auto">
              {lang === 'ru' ? 'Самые горячие скидки и акции со всего Узбекистана в одном месте.' : 'Butun O\'zbekiston bo\'ylab eng qaynoq chegirmalar va aksiyalar bitta joyda.'}
            </p>
          </div>

          <div className="relative group max-w-2xl mx-auto">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={24} />
            <Input 
              placeholder={t.search}
              className="h-16 pl-16 pr-6 rounded-full border-0 bg-white text-lg shadow-xl shadow-slate-200/50 focus-visible:ring-4 focus-visible:ring-primary/20 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        {/* Flash Deals Horizontal Scroll */}
        {viewMode === "feed" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="font-display font-black text-2xl flex items-center gap-2">
                <Flame size={24} className="text-primary animate-pulse" fill="currentColor" />
                {lang === 'ru' ? 'Горящие предложения' : 'Qaynoq takliflar'}
              </h3>
            </div>
            <div className="flex overflow-x-auto gap-4 pb-6 pt-2 px-2 no-scrollbar snap-x">
              {loading ? (
                [1, 2, 3].map(i => <Skeleton key={i} className="min-w-[300px] h-48 rounded-[32px]" />)
              ) : (
                nearbyDiscounts.map(d => (
                  <Card 
                    key={d.id} 
                    className="min-w-[300px] sm:min-w-[350px] snap-center rounded-[32px] border-0 bg-white hover:-translate-y-1 transition-all cursor-pointer group shadow-lg shadow-slate-200/50 overflow-hidden relative"
                    onClick={() => setSelectedDiscount(d)}
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150" />
                    <CardContent className="p-5 flex items-center gap-5 relative z-10">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 shadow-md">
                        <img 
                          src={`/api/image?url=${encodeURIComponent(d.source)}`}
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="inline-block bg-primary text-white font-display font-black text-sm px-2 py-0.5 rounded-lg mb-1 rotate-[-2deg]">
                          {d.discountAmount}
                        </div>
                        <h4 className="font-bold text-slate-800 text-base truncate">{d.store}</h4>
                        <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{d.title}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        )}

        {/* Categories & Main Feed */}
        <section className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <h2 className="text-3xl font-display font-black tracking-tight">
              {viewMode === "favorites" ? t.favorites : t.allDeals}
            </h2>
            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full sm:w-auto">
              <TabsList className="bg-transparent p-0 h-auto w-full sm:w-auto overflow-x-auto no-scrollbar justify-start sm:justify-center gap-2">
                {CATEGORIES.map(cat => (
                  <TabsTrigger 
                    key={cat.name} 
                    value={cat.name}
                    className="rounded-full px-6 py-3 text-sm font-bold bg-white text-slate-600 border border-slate-200 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:border-slate-900 shadow-sm transition-all"
                  >
                    {lang === "ru" ? cat.ru : cat.uz}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-4">
                  <Skeleton className="aspect-square rounded-[32px]" />
                </div>
              ))
            ) : filteredDiscounts.length === 0 && viewMode === "favorites" ? (
              <div className="col-span-full py-20 text-center space-y-4">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Heart size={40} />
                </div>
                <h3 className="text-2xl font-display font-bold text-slate-600">{t.noFavorites}</h3>
              </div>
            ) : filteredDiscounts.length > 0 ? (
              filteredDiscounts.map((discount, idx) => (
                <motion.div
                  key={discount.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card 
                    className="group border-0 bg-white rounded-[32px] p-2 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 cursor-pointer"
                    onClick={() => setSelectedDiscount(discount)}
                  >
                    <div className="relative aspect-square overflow-hidden rounded-[24px]">
                      <img 
                        src={`/api/image?url=${encodeURIComponent(discount.source)}`}
                        alt={discount.store}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <div className="absolute top-4 left-4">
                        <div className="bg-primary text-white font-display font-black text-2xl px-4 py-1.5 rounded-xl shadow-lg rotate-[-4deg] group-hover:rotate-0 transition-transform">
                          {discount.discountAmount}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => toggleFavorite(discount.id, e)}
                        className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-slate-400 hover:text-primary hover:scale-110 transition-all shadow-sm"
                      >
                        <Heart size={22} className={cn(favorites.has(discount.id) && "fill-primary text-primary")} />
                      </button>
                    </div>
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-display font-black truncate pr-2 text-slate-800">{discount.store}</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded-md">
                          {discount.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-600 line-clamp-2 leading-snug">{discount.title}</h4>

                      <div className="pt-3 mt-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock size={14} />
                          <span className="text-[11px] font-bold uppercase tracking-wider">
                            {t.added}: {formatDate(discount.createdAt)}
                          </span>
                        </div>
                        {discount.validUntil && (
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <Clock size={14} />
                            <span className="text-[11px] font-bold uppercase tracking-wider">
                              {t.validUntilLabel}: {discount.validUntil}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-20 text-center space-y-4">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Search size={40} />
                </div>
                <h3 className="text-2xl font-display font-bold text-slate-600">{t.noResults}</h3>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Detail Sheet */}
      <Sheet open={!!selectedDiscount} onOpenChange={() => setSelectedDiscount(null)}>
        <SheetContent side="bottom" className="h-[90vh] sm:h-[85vh] rounded-t-[40px] p-0 border-none overflow-hidden bg-surface">
          {selectedDiscount && (
            <div className="h-full flex flex-col">
              <div className="relative h-2/5 sm:h-1/2">
                <img 
                  src={`/api/image?url=${encodeURIComponent(selectedDiscount.source)}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSelectedDiscount(null)}
                  className="absolute top-6 right-6 w-12 h-12 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40"
                >
                  <X size={24} />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface to-transparent" />
                
                <div className="absolute -bottom-6 left-8 bg-primary text-white font-display font-black text-4xl px-6 py-2 rounded-2xl shadow-xl shadow-primary/30 rotate-[-3deg]">
                  {selectedDiscount.discountAmount}
                </div>
              </div>
              
              <div className="flex-1 px-8 py-10 space-y-8 overflow-y-auto no-scrollbar pb-32">
                <div className="space-y-3">
                  <Badge variant="secondary" className="bg-white text-slate-600 border border-slate-200 font-bold px-3 py-1 rounded-lg">
                    {selectedDiscount.category}
                  </Badge>
                  <h2 className="text-4xl font-display font-black leading-tight text-slate-900">{selectedDiscount.store}</h2>
                  <h3 className="text-xl font-bold text-slate-500">{selectedDiscount.title}</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-primary">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.added}</p>
                      <p className="font-bold text-sm text-slate-800">{formatDate(selectedDiscount.createdAt)}</p>
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-slate-100">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-primary">
                      <Clock size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.validUntil}</p>
                      <p className="font-bold text-sm text-slate-800">{selectedDiscount.validUntil || t.limited}</p>
                    </div>
                  </div>
                  <div 
                    className="bg-white p-4 rounded-2xl flex items-center gap-4 shadow-sm border border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors active:scale-95"
                    onClick={() => setShowMapModal(true)}
                  >
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-primary">
                      <MapPin size={24} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.distance}</p>
                      <p className="font-bold text-sm text-slate-800">~1.2 km</p>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 ml-auto" />
                  </div>
                </div>

                <div className="space-y-4 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
                  <h4 className="font-display font-black text-xl text-slate-900">{t.about}</h4>
                  <p className="text-slate-600 leading-relaxed font-medium text-lg">
                    {selectedDiscount.description}
                  </p>
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-xl border-t border-slate-100 flex gap-4">
                <Button
                  variant="outline"
                  className="h-16 rounded-2xl border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => setSelectedDiscount(null)}
                >
                  <ChevronRight size={24} className="mr-2 text-slate-600 rotate-180" />
                  {lang === 'ru' ? 'Назад' : 'Orqaga'}
                </Button>
                <Button
                  className="flex-1 h-16 rounded-2xl bg-primary hover:bg-primary/90 text-white font-display font-black text-xl shadow-xl shadow-primary/30 transition-transform active:scale-95"
                  onClick={() => window.open(`https://${selectedDiscount.source}`, "_blank")}
                >
                  <Zap size={24} className="mr-2" fill="currentColor" />
                  {t.openInTelegram}
                </Button>
                <Button
                  variant="outline"
                  className="w-16 h-16 rounded-2xl border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => {
                    awardXp(20, lang === 'ru' ? 'Скидка отправлена!' : 'Chegirma ulashildi!', { sharedCount: stats.sharedCount + 1 });
                    if (navigator.share) {
                      navigator.share({
                        title: selectedDiscount.title,
                        text: selectedDiscount.description,
                        url: `https://${selectedDiscount.source}`
                      }).catch(console.error);
                    } else {
                      navigator.clipboard.writeText(`https://${selectedDiscount.source}`);
                      toast.success(lang === 'ru' ? 'Ссылка скопирована!' : 'Havola nusxalandi!');
                    }
                  }}
                >
                  <Share2 size={24} className="text-slate-600" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile Nav */}
      <nav className="sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 h-16 bg-slate-900/95 backdrop-blur-xl rounded-full flex justify-around items-center z-50 shadow-2xl px-8 w-[85%] max-w-sm">
        <button 
          onClick={() => setViewMode("feed")}
          className={cn("flex flex-col items-center gap-1 transition-colors", viewMode === "feed" ? "text-white" : "text-slate-400 hover:text-white")}
        >
          <Flame size={24} strokeWidth={2.5} fill={viewMode === "feed" ? "currentColor" : "none"} />
        </button>
        <button 
          onClick={() => setShowMapModal(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors"
        >
          <MapIcon size={24} strokeWidth={2.5} />
        </button>
        <button 
          onClick={() => setShowProfileModal(true)}
          className="flex flex-col items-center gap-1 text-amber-500/80 hover:text-amber-400 transition-colors"
        >
          <Trophy size={24} strokeWidth={2.5} />
        </button>
        <button 
          onClick={() => setViewMode("favorites")}
          className={cn("flex flex-col items-center gap-1 transition-colors", viewMode === "favorites" ? "text-white" : "text-slate-400 hover:text-white")}
        >
          <Heart size={24} strokeWidth={2.5} fill={viewMode === "favorites" ? "currentColor" : "none"} />
        </button>
      </nav>

      {/* Profile / Gamification Modal */}
      <Dialog open={showProfileModal} onOpenChange={setShowProfileModal}>
        <DialogContent className="sm:max-w-md rounded-[32px] p-6 bg-slate-50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-display font-bold text-center flex items-center justify-center gap-2">
              <Trophy className="text-amber-500" size={28} />
              {lang === 'ru' ? 'Профиль охотника' : 'Ovchi profili'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4 space-y-6">
            {/* Level Card */}
            <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Award size={64} />
              </div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">
                {lang === 'ru' ? 'Текущий уровень' : 'Joriy daraja'}
              </p>
              <h3 className="text-4xl font-display font-black text-slate-800 mb-4">
                Level {stats.level}
              </h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-slate-500">
                  <span>{stats.xp} XP</span>
                  <span>{Math.pow(stats.level, 2) * 100} XP</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-1000"
                    style={{ width: `${(stats.xp / (Math.pow(stats.level, 2) * 100)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {lang === 'ru' ? 'До следующего уровня:' : 'Keyingi darajagacha:'} {Math.pow(stats.level, 2) * 100 - stats.xp} XP
                </p>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-[20px] shadow-sm border border-slate-100 text-center">
                <Flame className="mx-auto text-orange-500 mb-2" size={24} />
                <p className="text-2xl font-black text-slate-800">{stats.streak}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'ru' ? 'Дней подряд' : 'Kunlar'}</p>
              </div>
              <div className="bg-white p-4 rounded-[20px] shadow-sm border border-slate-100 text-center">
                <Heart className="mx-auto text-rose-500 mb-2" size={24} />
                <p className="text-2xl font-black text-slate-800">{stats.savedCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'ru' ? 'Сохранено' : 'Saqlangan'}</p>
              </div>
              <div className="bg-white p-4 rounded-[20px] shadow-sm border border-slate-100 text-center">
                <Share2 className="mx-auto text-blue-500 mb-2" size={24} />
                <p className="text-2xl font-black text-slate-800">{stats.sharedCount}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">{lang === 'ru' ? 'Поделились' : 'Ulashilgan'}</p>
              </div>
            </div>

            {/* Badges */}
            <div>
              <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Star size={18} className="text-amber-500" />
                {lang === 'ru' ? 'Достижения' : 'Yutuqlar'}
              </h4>
              <div className="space-y-3">
                <div className={cn("flex items-center gap-4 p-3 rounded-2xl border", stats.streak >= 3 ? "bg-orange-50 border-orange-100" : "bg-white border-slate-100 opacity-50 grayscale")}>
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                    <Flame size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{lang === 'ru' ? 'В огне!' : 'Olovda!'}</p>
                    <p className="text-xs text-slate-500">{lang === 'ru' ? 'Заходите 3 дня подряд' : '3 kun ketma-ket kiring'}</p>
                  </div>
                </div>
                <div className={cn("flex items-center gap-4 p-3 rounded-2xl border", stats.savedCount >= 5 ? "bg-rose-50 border-rose-100" : "bg-white border-slate-100 opacity-50 grayscale")}>
                  <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-500">
                    <Heart size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-slate-800">{lang === 'ru' ? 'Коллекционер' : 'Kolleksioner'}</p>
                    <p className="text-xs text-slate-500">{lang === 'ru' ? 'Сохраните 5 скидок' : '5 ta chegirma saqlang'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Map Modal */}
      <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
        <DialogContent className="sm:max-w-md rounded-[32px] p-8 text-center">
          <DialogHeader>
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapIcon size={40} className="text-primary" />
            </div>
            <DialogTitle className="text-2xl font-display font-bold text-center">
              {lang === 'ru' ? 'Карта скидок' : 'Chegirmalar xaritasi'}
            </DialogTitle>
            <DialogDescription className="text-center text-base mt-2">
              {lang === 'ru' 
                ? 'Мы работаем над картой! Скоро вы сможете видеть все скидки рядом с вами в реальном времени.' 
                : 'Biz xarita ustida ishlayapmiz! Tez orada siz atrofingizdagi barcha chegirmalarni real vaqtda ko\'rishingiz mumkin bo\'ladi.'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6">
            <Button 
              onClick={() => setShowMapModal(false)}
              className="w-full rounded-2xl h-14 font-bold text-lg bg-primary hover:bg-primary/90 text-white"
            >
              {lang === 'ru' ? 'Понятно' : 'Tushunarli'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster position="top-center" />
    </div>
  );
}
