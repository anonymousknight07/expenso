import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useCurrency } from "../contexts/CurrencyContext";
import {
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  Target,
  PiggyBank,
  Coffee,
  Home,
  Car,
  Gamepad2,
  Heart,
  GraduationCap,
  Plane,
  ShoppingBag,
  Utensils,
  CircleDot as DragHandleDots2,
  Save,
  RefreshCw,
  Menu,
  X,
} from "lucide-react";
import Button from "../components/common/Button";
import { toast } from "react-hot-toast";

interface Jar {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  color: string;
  icon: string;
  position_x: number;
  position_y: number;
  user_id: string;
}

interface DraggedMoney {
  id: string;
  amount: number;
  x: number;
  y: number;
  isDragging: boolean;
}

const JAR_ICONS = {
  PiggyBank,
  Coffee,
  Home,
  Car,
  Gamepad2,
  Heart,
  GraduationCap,
  Plane,
  ShoppingBag,
  Utensils,
  Target,
  Sparkles,
};

const JAR_COLORS = [
  "#FF6B6BCC",
  "#4ECDC4CC",
  "#45B7D1CC",
  "#96CEB4CC",
  "#FFEAA7CC",
  "#DDA0DDCC",
  "#98D8C8CC",
  "#F7DC6FCC",
  "#BB8FCECC",
  "#85C1E9CC",
  "#F8C471CC",
  "#82E0AACC",
];

const MONEY_DENOMINATIONS = [5, 10, 15, 20, 25, 50, 100, 500, 1000];

const JarSystem = () => {
  const [jars, setJars] = useState<Jar[]>([]);
  const [availableMoney, setAvailableMoney] = useState(0);
  const [draggedMoney, setDraggedMoney] = useState<DraggedMoney[]>([]);
  const [isAddingJar, setIsAddingJar] = useState(false);
  const [clickToMoveMode, setClickToMoveMode] = useState(false);
  const [movingJar, setMovingJar] = useState<string | null>(null);
  const [movingMoney, setMovingMoney] = useState<string | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { currency, calculateEffectiveIncome } = useCurrency();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [fullJar, setFullJar] = useState<Jar | null>(null);
  const animationFrameRef = useRef<number>(0);
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [isDraggingTouch, setIsDraggingTouch] = useState(false);
  const [draggedElement, setDraggedElement] = useState(null);
  const [longPressTimer, setLongPressTimer] = useState(null);

  const [newJar, setNewJar] = useState({
    name: "",
    target_amount: "",
    color: JAR_COLORS[0],
    icon: "PiggyBank",
  });

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    fetchJars();
    fetchAvailableMoney();
  }, []);
  useEffect(() => {
    const preventScroll = (e) => {
      if (isDraggingTouch) {
        e.preventDefault();
      }
    };

    if (isDraggingTouch) {
      document.addEventListener("touchmove", preventScroll, { passive: false });
      document.body.style.overflow = "hidden";
    } else {
      document.removeEventListener("touchmove", preventScroll);
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("touchmove", preventScroll);
      document.body.style.overflow = "";
    };
  }, [isDraggingTouch]);

  const fetchAvailableMoney = async () => {
    const income = await calculateEffectiveIncome();

    const totalAllocated = jars.reduce(
      (sum, jar) => sum + jar.current_amount,
      0
    );

    setAvailableMoney(Math.max(0, income - totalAllocated));
  };

  const fetchJars = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("money_jars")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");

    if (error) {
      console.error("Error fetching jars:", error);
      return;
    }

    setJars(data || []);
  };

  const handleAddJar = async (e: React.FormEvent) => {
    e.preventDefault();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const containerWidth = isMobile ? 300 : 600;
    const containerHeight = isMobile ? 200 : 400;
    const randomX = Math.round(Math.random() * (containerWidth - 100) + 50);
    const randomY = Math.round(Math.random() * (containerHeight - 100) + 100);

    const { error } = await supabase.from("money_jars").insert([
      {
        name: newJar.name,
        target_amount: parseFloat(newJar.target_amount),
        current_amount: 0,
        color: newJar.color,
        icon: newJar.icon,
        position_x: randomX,
        position_y: randomY,
        user_id: user.id,
      },
    ]);

    if (error) {
      console.error("Error adding jar:", error);
      toast.error("Failed to create jar");
      return;
    }

    setNewJar({
      name: "",
      target_amount: "",
      color: JAR_COLORS[0],
      icon: "PiggyBank",
    });
    setIsAddingJar(false);
    fetchJars();
    toast.success("Jar created successfully! 🎉");
  };
  const handleDeleteJar = async (jarId: string) => {
    const jar = jars.find((j) => j.id === jarId);
    if (!jar) return;

    
    setAvailableMoney((prev) => prev + jar.current_amount);

    const { error } = await supabase
      .from("money_jars")
      .delete()
      .eq("id", jarId);

    if (error) {
      console.error("Error deleting jar:", error);
      toast.error("Failed to delete jar");
      return;
    }

    fetchJars();

    if (jar.current_amount >= jar.target_amount) {
      toast.success(
        `🎉 ${jar.name} jar was full but now it's gone! Money returned! 💰`
      );
    } else {
      toast.success("Jar deleted and money returned! 💰");
    }
  };
  const handleTouchStart = (e, type, id) => {
    // Prevent scrolling when starting a drag
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY });

    // Long press detection for drag initiation
    const timer = setTimeout(() => {
      setIsDraggingTouch(true);
      setDraggedElement({ type, id });
      // Add haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, 300); // 300ms long press

    setLongPressTimer(timer);
  };

  const handleTouchMove = (e, type, id) => {
    if (!isDraggingTouch || !draggedElement) return;

   
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    if (type === "jar") {
      const jarSize = isMobile ? 50 : 65;
      const maxX = rect.width - (isMobile ? 100 : 128);
      const maxY = rect.height - (isMobile ? 120 : 160);

      setJars((prev) =>
        prev.map((jar) =>
          jar.id === id
            ? {
                ...jar,
                position_x: Math.max(0, Math.min(x - jarSize, maxX)),
                position_y: Math.max(0, Math.min(y - jarSize, maxY)),
              }
            : jar
        )
      );
    } else if (type === "money") {
      setDraggedMoney((prev) =>
        prev.map((money) =>
          money.id === id
            ? {
                ...money,
                x: Math.max(0, x - 30),
                y: Math.max(0, y - 30),
              }
            : money
        )
      );
    }
  };

  const handleTouchEnd = async (e, type, id) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    if (!isDraggingTouch) return;

    if (type === "jar") {
      const updatedJar = jars.find((j) => j.id === id);
      if (updatedJar) {
        const { error } = await supabase
          .from("money_jars")
          .update({
            position_x: Math.round(updatedJar.position_x),
            position_y: Math.round(updatedJar.position_y),
          })
          .eq("id", id);

        if (error) {
          console.error("Error updating jar position:", error);
        }
      }
    } else if (type === "money") {
      // Handle money drop logic (same as existing handleMoneyDragEnd)
      const draggingMoney = draggedMoney.find((m) => m.id === id);
      if (!draggingMoney) return;

      let droppedOnJar = false;

      for (const jar of jars) {
        const jarElement = document.getElementById(`jar-${jar.id}`);
        if (!jarElement) continue;

        const jarRect = jarElement.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) continue;

        const jarX = jarRect.left - containerRect.left;
        const jarY = jarRect.top - containerRect.top;
        const dropZone = isMobile ? 30 : 50;

        if (
          draggingMoney.x >= jarX - dropZone &&
          draggingMoney.x <= jarX + jarRect.width + dropZone &&
          draggingMoney.y >= jarY - dropZone &&
          draggingMoney.y <= jarY + jarRect.height + dropZone
        ) {
          // Handle jar drop logic (copy from existing code)
          if (jar.current_amount >= jar.target_amount) {
            toast.error(`🍯 ${jar.name} jar is already full! 🚫`);
            setAvailableMoney((prev) => prev + draggingMoney.amount);
            setDraggedMoney((prev) =>
              prev.filter((m) => m.id !== draggingMoney.id)
            );
            droppedOnJar = true;
            break;
          }

          const newAmount = jar.current_amount + draggingMoney.amount;
          if (newAmount > jar.target_amount) {
            const excessAmount = newAmount - jar.target_amount;
            toast.error(
              `🎯 ${jar.name} only needs ${currency.symbol}${(
                jar.target_amount - jar.current_amount
              ).toFixed(2)} more!`
            );
            setAvailableMoney((prev) => prev + draggingMoney.amount);
            setDraggedMoney((prev) =>
              prev.filter((m) => m.id !== draggingMoney.id)
            );
            droppedOnJar = true;
            break;
          }

          const { error } = await supabase
            .from("money_jars")
            .update({ current_amount: newAmount })
            .eq("id", jar.id);

          if (!error) {
            setDraggedMoney((prev) =>
              prev.filter((m) => m.id !== draggingMoney.id)
            );
            fetchJars();
            toast.success(
              `💰 Added ${currency.symbol}${draggingMoney.amount} to ${jar.name}!`
            );
            droppedOnJar = true;
          }
          break;
        }
      }

      if (!droppedOnJar) {
        setAvailableMoney((prev) => prev + draggingMoney.amount);
        setDraggedMoney((prev) =>
          prev.filter((m) => m.id !== draggingMoney.id)
        );
      }
    }

    setIsDraggingTouch(false);
    setDraggedElement(null);
  };
  const createMoneyDrop = (amount: number) => {
    if (availableMoney < amount) {
      toast.error("Not enough money available!");
      return;
    }

    const newMoney: DraggedMoney = {
      id: Date.now().toString(),
      amount,
      x: isMobile ? Math.random() * 100 + 50 : Math.random() * 200 + 100,
      y: isMobile ? 30 : 50,
      isDragging: false,
    };

    setDraggedMoney((prev) => [...prev, newMoney]);
    setAvailableMoney((prev) => prev - amount);
  };

  const handleMoneyDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    moneyId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

   
    if (movingMoney === moneyId) {
      
      const now = Date.now();
      const lastClick = (e.currentTarget as any).lastClickTime || 0;
      (e.currentTarget as any).lastClickTime = now;

      if (now - lastClick < 300) {
      
        setMovingMoney(null);
        setClickToMoveMode(false);
      }
      return;
    }


    if (movingMoney && movingMoney !== moneyId) {
      setMovingMoney(null);
      setClickToMoveMode(false);
    }

   
    setMovingMoney(moneyId);
    setClickToMoveMode(true);
  };

  const handleMoneyDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!clickToMoveMode || !movingMoney) return;
    e.preventDefault();

    cancelAnimationFrame(animationFrameRef.current);

    animationFrameRef.current = requestAnimationFrame(() => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = clientX - rect.left - 30; // Center the money
      const y = clientY - rect.top - 30;

      setDraggedMoney((prev) =>
        prev.map((m) =>
          m.id === movingMoney
            ? { ...m, x: Math.max(0, x), y: Math.max(0, y) }
            : m
        )
      );
    });
  };
  const handleMoneyDragEnd = async (
    e?: React.MouseEvent | React.TouchEvent
  ) => {
    if (!clickToMoveMode || !movingMoney) return;

 
    if (e && (e.target as HTMLElement).closest('[id^="jar-"]')) {
      return;
    }

    const draggingMoney = draggedMoney.find((m) => m.id === movingMoney);
    if (!draggingMoney) return;

    let droppedOnJar = false;
    let targetJar: Jar | null = null;

    for (const jar of jars) {
      const jarElement = document.getElementById(`jar-${jar.id}`);
      if (!jarElement) continue;

      const jarRect = jarElement.getBoundingClientRect();
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) continue;

      const jarX = jarRect.left - containerRect.left;
      const jarY = jarRect.top - containerRect.top;

      const dropZone = isMobile ? 30 : 50;

      if (
        draggingMoney.x >= jarX - dropZone &&
        draggingMoney.x <= jarX + jarRect.width + dropZone &&
        draggingMoney.y >= jarY - dropZone &&
        draggingMoney.y <= jarY + jarRect.height + dropZone
      ) {
        targetJar = jar;

    
        if (jar.current_amount >= jar.target_amount) {
          const funMessages = [
            `🍯 ${jar.name} jar is already stuffed! No more room! 🚫`,
            `🎪 ${jar.name} is at max capacity! The jar says "I'm full!" 🤪`,
            `🎯 ${jar.name} has reached the finish line! No more money needed! 🏁`,
            `💝 ${jar.name} is completely satisfied! It can't eat anymore! 😋`,
            `🎈 ${jar.name} might pop if you add more! Safety first! 💥`,
          ];
          const randomMessage =
            funMessages[Math.floor(Math.random() * funMessages.length)];
          toast.error(randomMessage);

          
          setAvailableMoney((prev) => prev + draggingMoney.amount);
          setDraggedMoney((prev) =>
            prev.filter((m) => m.id !== draggingMoney.id)
          );
          droppedOnJar = true; 
          break;
        }

      
        const newAmount = jar.current_amount + draggingMoney.amount;
        if (newAmount > jar.target_amount) {
          const excessAmount = newAmount - jar.target_amount;
          const funExcessMessages = [
            `🤯 Whoa there! ${jar.name} would burst with an extra ${
              currency.symbol
            }${excessAmount.toFixed(2)}! 💥`,
            `🎪 That's too much for ${jar.name}! It would overflow by ${
              currency.symbol
            }${excessAmount.toFixed(2)}! 🌊`,
            `🎯 Almost! But ${jar.name} only needs ${currency.symbol}${(
              jar.target_amount - jar.current_amount
            ).toFixed(2)} more! 🎲`,
            `🍯 ${jar.name} is on a diet! ${currency.symbol}${draggingMoney.amount} is too much honey! 🐝`,
            `🎈 Careful! ${jar.name} might float away with that much extra! 🎈`,
          ];
          const randomExcessMessage =
            funExcessMessages[
              Math.floor(Math.random() * funExcessMessages.length)
            ];
          toast.error(randomExcessMessage);

          
          setAvailableMoney((prev) => prev + draggingMoney.amount);
          setDraggedMoney((prev) =>
            prev.filter((m) => m.id !== draggingMoney.id)
          );
          droppedOnJar = true; 
          break;
        }

       
        const isFull = newAmount >= jar.target_amount;

        const { error } = await supabase
          .from("money_jars")
          .update({
            current_amount: newAmount,
          })
          .eq("id", jar.id);

        if (!error) {
          setDraggedMoney((prev) =>
            prev.filter((m) => m.id !== draggingMoney.id)
          );
          fetchJars();

          if (isFull) {
            setFullJar(jar);
            setShowCelebration(true);
            setTimeout(() => {
              setShowCelebration(false);
              setTimeout(() => setFullJar(null), 1000);
            }, 3000);

            toast.success(`🎉 ${jar.name} jar is full! Great job!`);
          } else {
            toast.success(
              `💰 Added ${currency.symbol}${draggingMoney.amount} to ${jar.name}!`
            );
          }
          droppedOnJar = true;
        } else {
        
          setAvailableMoney((prev) => prev + draggingMoney.amount);
          setDraggedMoney((prev) =>
            prev.filter((m) => m.id !== draggingMoney.id)
          );
          toast.error("Failed to add money to jar. Money returned.");
          droppedOnJar = true;
        }
        break;
      }
    }

   
    if (!droppedOnJar) {
      setAvailableMoney((prev) => prev + draggingMoney.amount);
      setDraggedMoney((prev) => prev.filter((m) => m.id !== draggingMoney.id));
    }

    setMovingMoney(null);
    setClickToMoveMode(false);
  };

  const handleJarDragStart = (
    e: React.MouseEvent | React.TouchEvent,
    jarId: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (movingJar === jarId) {
   
      setMovingJar(null);
      setClickToMoveMode(false);
    } else {
      // First click - start moving
      setMovingJar(jarId);
      setClickToMoveMode(true);
    }
  };

  const handleJarDrag = (e: React.MouseEvent | React.TouchEvent) => {
    if (!clickToMoveMode || !movingJar) return;
    e.preventDefault();

    cancelAnimationFrame(animationFrameRef.current);

    animationFrameRef.current = requestAnimationFrame(() => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = clientX - rect.left - (isMobile ? 50 : 65); // Center the jar
      const y = clientY - rect.top - (isMobile ? 65 : 80);

      const maxX = rect.width - (isMobile ? 100 : 128);
      const maxY = rect.height - (isMobile ? 120 : 160);

      setJars((prev) =>
        prev.map((jar) =>
          jar.id === movingJar
            ? {
                ...jar,
                position_x: Math.max(0, Math.min(x, maxX)),
                position_y: Math.max(0, Math.min(y, maxY)),
              }
            : jar
        )
      );
    });
  };

  const handleJarDragEnd = async () => {
    if (!clickToMoveMode || !movingJar) return;

    const updatedJar = jars.find((j) => j.id === movingJar);
    if (!updatedJar) return;

    const { error } = await supabase
      .from("money_jars")
      .update({
        position_x: Math.round(updatedJar.position_x),
        position_y: Math.round(updatedJar.position_y),
      })
      .eq("id", movingJar);

    if (error) {
      console.error("Error updating jar position:", error);
    }

    setMovingJar(null);
    setClickToMoveMode(false);
  };

  const resetAllJars = async () => {
    const totalMoney = jars.reduce((sum, jar) => sum + jar.current_amount, 0);

    const { error } = await supabase
      .from("money_jars")
      .update({ current_amount: 0 })
      .in(
        "id",
        jars.map((j) => j.id)
      );

    if (error) {
      console.error("Error resetting jars:", error);
      toast.error("Failed to reset jars");
      return;
    }

    setAvailableMoney((prev) => prev + totalMoney);
    fetchJars();
    toast.success("All jars reset! Money returned to available pool 🔄");
  };

  const IconComponent = (iconName: string) => {
    const Icon = JAR_ICONS[iconName as keyof typeof JAR_ICONS] || PiggyBank;
    return <Icon className={`${isMobile ? "w-6 h-6" : "w-8 h-8"}`} />;
  };

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8 max-w-full overflow-x-hidden">
      {/* Celebration Effect */}
      {showCelebration && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="text-4xl sm:text-6xl animate-bounce">🎉</div>
          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 opacity-20 animate-pulse"></div>
        </div>
      )}

      {/* Full Jar Popup */}
      {fullJar && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full transform transition-all duration-500 scale-0 animate-scaleIn">
            <div className="flex flex-col items-center text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-2xl font-bold mb-2">Jar Full!</h3>
              <p className="text-gray-600 mb-4">
                Your <span className="font-bold">{fullJar.name}</span> jar has
                reached its goal!
              </p>
              <div
                className="w-32 h-40 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden"
                style={{ backgroundColor: fullJar.color }}
              >
                <div className="absolute bottom-0 left-0 right-0 h-full bg-white bg-opacity-30" />
                <div className="text-white font-bold text-xl">
                  {IconComponent(fullJar.icon)}
                </div>
              </div>
              <Button
                onClick={() => setFullJar(null)}
                variant="primary"
                className="mt-4"
              >
                Awesome!
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2 flex-wrap">
                <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow flex-shrink-0" />
                <span className="break-words">Visual Jar System</span>
              </h1>
              <p className="text-gray-600 mt-2 text-sm sm:text-base">
                Drag money into jars to allocate your income! 💰
              </p>
            </div>

            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="sm:hidden bg-gray-100 p-2 rounded-lg"
            >
              {showMobileMenu ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          <div
            className={`flex flex-col sm:flex-row gap-2 sm:gap-4 ${
              showMobileMenu ? "flex" : "hidden sm:flex"
            }`}
          >
            <Button
              onClick={() => setIsAddingJar(true)}
              variant="primary"
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Add Jar
            </Button>
            <Button
              onClick={resetAllJars}
              variant="outline"
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Reset All
            </Button>
            <Button
              onClick={fetchAvailableMoney}
              variant="outline"
              className="w-full sm:w-auto text-sm sm:text-base"
            >
              <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Available Money */}
        {/* <div className="bg-gradient-to-r from-green-400 to-green-600 text-white p-4 sm:p-6 rounded-lg shadow-lg">
          <h2 className="text-lg sm:text-xl font-semibold mb-2">
            Available Money
          </h2>
          <p className="text-2xl sm:text-3xl font-bold break-all">
            {currency.symbol}
            {availableMoney.toFixed(2)}
          </p>
          <p className="text-green-100 mt-2 text-sm sm:text-base">
            Click on money denominations below to create draggable money!
          </p>
        </div> */}

        {/* Money Denominations */}
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
          <h3 className="text-base sm:text-lg font-semibold mb-4">
            Create Money to Allocate
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
            {MONEY_DENOMINATIONS.map((amount) => (
              <button
                key={amount}
                onClick={() => createMoneyDrop(amount)}
                disabled={availableMoney < amount}
                className={`p-2 sm:p-4 rounded-lg border-2 border-dashed transition-all transform hover:scale-105 ${
                  availableMoney >= amount
                    ? "border-green-400 bg-green-50 hover:bg-green-100 text-green-700 cursor-pointer"
                    : "border-gray-300 bg-gray-50 text-gray-400 cursor-not-allowed"
                }`}
              >
                <div className="text-sm sm:text-lg font-bold break-all">
                  {currency.symbol}
                  {amount}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Jar Area */}
      <div
        ref={containerRef}
        className={`relative bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4 sm:p-8 border-2 border-dashed border-blue-200 overflow-hidden ${
          isMobile ? "min-h-[400px]" : "min-h-[600px]"
        }`}
        style={{
          touchAction: isDraggingTouch ? "none" : "auto",
        }}
        onMouseMove={
          clickToMoveMode
            ? movingJar
              ? handleJarDrag
              : handleMoneyDrag
            : undefined
        }
        onClick={
          clickToMoveMode && movingMoney ? handleMoneyDragEnd : undefined
        }
      >
        <div className="text-center text-gray-500 mb-6 sm:mb-8">
          <h3 className="text-lg sm:text-xl font-semibold">Your Money Jars</h3>
          <p className="text-sm sm:text-base">
            {isMobile
              ? "Long press and drag to move • Drop money into jars • Tap delete button to remove"
              : "Drag jars around to organize them • Drop money into jars to allocate funds"}
          </p>
        </div>

        {/* Jars */}
        {jars.map((jar) => {
          const progress = (jar.current_amount / jar.target_amount) * 100;
          const isOverflowing = jar.current_amount > jar.target_amount;
          const jarSize = isMobile ? "w-24 h-32" : "w-32 h-40";

          return (
            <div
              key={jar.id}
              id={`jar-${jar.id}`}
              className={`absolute transition-transform duration-300 ${
                movingJar === jar.id ||
                (isDraggingTouch &&
                  draggedElement?.type === "jar" &&
                  draggedElement?.id === jar.id)
                  ? "z-20 scale-105 cursor-crosshair shadow-2xl"
                  : "z-10 hover:scale-105 cursor-pointer"
              }`}
              style={{
                left: Math.min(
                  jar.position_x,
                  window.innerWidth - (isMobile ? 100 : 140)
                ),
                top: jar.position_y,
                touchAction: "none", // Prevent scrolling on jar elements
              }}
              onMouseDown={(e) => {
                if (!(e.target as HTMLElement).closest("button")) {
                  handleJarDragStart(e, jar.id);
                }
              }}
              onTouchStart={(e) => {
                if (!(e.target as HTMLElement).closest("button")) {
                  handleTouchStart(e, "jar", jar.id);
                }
              }}
              onTouchMove={(e) => handleTouchMove(e, "jar", jar.id)}
              onTouchEnd={(e) => handleTouchEnd(e, "jar", jar.id)}
            >
              <div
                className={`relative ${jarSize} rounded-lg shadow-lg border-2 sm:border-4 border-white overflow-hidden transition-all duration-300`}
                style={{ backgroundColor: jar.color }}
              >
                {/* Jar Content */}
                <div className="p-2 sm:p-3 text-center">
                  <div className="text-white mb-1">
                    {IconComponent(jar.icon)}
                  </div>
                  <h4 className="text-white font-bold text-xs sm:text-sm truncate">
                    {jar.name}
                  </h4>
                </div>

                {/* Jar Fill Level */}
                <div className="absolute bottom-0 left-0 right-0">
                  <div
                    className={`transition-all duration-500 ${
                      isOverflowing ? "bg-yellow-300" : "bg-white bg-opacity-30"
                    }`}
                    style={{
                      height: `${Math.min(progress, 100)}%`,
                    }}
                  />
                  {isOverflowing && (
                    <div className="absolute top-0 left-0 right-0 h-full bg-yellow-300 animate-pulse opacity-50" />
                  )}
                </div>

                {/* Jar Amounts */}
                <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 right-1 sm:right-2 text-center">
                  <div className="text-white text-xs font-bold bg-black bg-opacity-30 rounded px-1">
                    {currency.symbol}
                    {jar.current_amount.toFixed(0)}
                  </div>
                  <div className="text-white text-xs opacity-75">
                    / {currency.symbol}
                    {jar.target_amount.toFixed(0)}
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDeleteJar(jar.id);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  className={`absolute top-1 right-1 ${
                    isMobile ? "w-5 h-5" : "w-6 h-6"
                  } bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer z-30`}
                  style={{ cursor: "pointer !important" }}
                >
                  <Trash2 className={`${isMobile ? "w-2 h-2" : "w-3 h-3"}`} />
                </button>

                {/* Drag Handle */}
                <div className="absolute top-1 left-1 text-white opacity-50">
                  <DragHandleDots2
                    className={`${isMobile ? "w-3 h-3" : "w-4 h-4"}`}
                  />
                </div>

                {/* Full Jar Indicator */}
                {progress >= 100 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                    <div
                      className={`text-white ${
                        isMobile ? "text-lg" : "text-2xl"
                      } animate-bounce`}
                    >
                      🎉
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Draggable Money */}
        {draggedMoney.map((money) => {
          const moneySize = isMobile ? "w-12 h-12" : "w-16 h-16";

          return (
            <div
              key={money.id}
              className={`absolute z-30 transition-transform duration-300 ${
                movingMoney === money.id ||
                (isDraggingTouch &&
                  draggedElement?.type === "money" &&
                  draggedElement?.id === money.id)
                  ? "scale-110 z-40 cursor-crosshair shadow-2xl"
                  : "hover:scale-105 cursor-pointer"
              }`}
              style={{
                left: money.x,
                top: money.y,
                transition:
                  movingMoney === money.id ? "none" : "transform 0.3s ease",
                touchAction: "none", // Prevent scrolling on money elements
              }}
              onMouseDown={(e) => handleMoneyDragStart(e, money.id)}
              onTouchStart={(e) => handleTouchStart(e, "money", money.id)}
              onTouchMove={(e) => handleTouchMove(e, "money", money.id)}
              onTouchEnd={(e) => handleTouchEnd(e, "money", money.id)}
            >
              <div
                className={`${moneySize} rounded-full shadow-lg border-4 border-yellow-500 flex items-center justify-center bg-gradient-to-br from-yellow-300 to-yellow-500`}
              >
                <div className="text-white font-bold text-xs sm:text-sm text-center">
                  {currency.symbol}
                  {money.amount}
                </div>
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {jars.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-gray-400 px-4">
              <PiggyBank
                className={`${
                  isMobile ? "w-12 h-12" : "w-16 h-16"
                } mx-auto mb-4 opacity-50`}
              />
              <p className={`${isMobile ? "text-base" : "text-lg"}`}>
                No jars yet!
              </p>
              <p className="text-sm sm:text-base">
                Create your first jar to start allocating money
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Add Jar Modal */}
      {isAddingJar && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 sm:p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg sm:text-xl font-bold mb-4">
              Create New Jar
            </h2>
            <form onSubmit={handleAddJar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Jar Name
                </label>
                <input
                  type="text"
                  value={newJar.name}
                  onChange={(e) =>
                    setNewJar({ ...newJar, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                  placeholder="e.g., Emergency Fund, Vacation"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Target Amount ({currency.symbol})
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newJar.target_amount}
                  onChange={(e) =>
                    setNewJar({ ...newJar, target_amount: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded text-sm sm:text-base"
                  placeholder="1000.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Icon</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {Object.keys(JAR_ICONS).map((iconName) => {
                    const Icon = JAR_ICONS[iconName as keyof typeof JAR_ICONS];
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setNewJar({ ...newJar, icon: iconName })}
                        className={`p-2 sm:p-3 rounded border-2 flex items-center justify-center ${
                          newJar.icon === iconName
                            ? "border-yellow bg-yellow-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Color</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {JAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewJar({ ...newJar, color })}
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full border-2 ${
                        newJar.color === color
                          ? "border-black"
                          : "border-gray-300"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2">
                <Button
                  onClick={() => setIsAddingJar(false)}
                  variant="outline"
                  className="w-full sm:w-auto text-sm sm:text-base"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full sm:w-auto text-sm sm:text-base"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Create Jar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default JarSystem;
