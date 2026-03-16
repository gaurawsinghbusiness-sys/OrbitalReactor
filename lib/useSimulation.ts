import { useState, useEffect, useCallback } from 'react';

export type Region = 'North America' | 'Middle East' | 'Europe' | 'Asia';
export type Resource = 'Energy' | 'Food' | 'Technology' | 'Materials';

export interface RegionStats {
  name: Region;
  stability: number; // 0-100
  resourceOutput: Record<Resource, number>; // Production rate
}

export interface GlobalStats {
  stability: number;
  environment: number;
  economy: number;
  resources: Record<Resource, number>; // Current stockpile
}

export interface CrisisEvent {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: {
    global?: Partial<GlobalStats>;
    regions?: Partial<Record<Region, Partial<RegionStats>>>;
  };
  timestamp: number;
}

const INITIAL_GLOBAL: GlobalStats = {
  stability: 85,
  environment: 70,
  economy: 80,
  resources: {
    Energy: 1000,
    Food: 1000,
    Technology: 1000,
    Materials: 1000,
  },
};

const INITIAL_REGIONS: Record<Region, RegionStats> = {
  'North America': { name: 'North America', stability: 90, resourceOutput: { Energy: 20, Food: 30, Technology: 40, Materials: 10 } },
  'Middle East': { name: 'Middle East', stability: 60, resourceOutput: { Energy: 60, Food: 10, Technology: 5, Materials: 25 } },
  'Europe': { name: 'Europe', stability: 85, resourceOutput: { Energy: 10, Food: 20, Technology: 30, Materials: 20 } },
  'Asia': { name: 'Asia', stability: 80, resourceOutput: { Energy: 15, Food: 40, Technology: 25, Materials: 45 } },
};

const POSSIBLE_EVENTS: Omit<CrisisEvent, 'id' | 'timestamp'>[] = [
  {
    title: 'Strait of Hormuz Blockade',
    description: 'Shipping lanes restricted, causing a massive spike in global energy prices and supply chain disruptions.',
    severity: 'critical',
    impact: {
      global: { economy: -15, stability: -10 },
      regions: { 'Middle East': { stability: -20 }, 'Europe': { stability: -5 } },
    },
  },
  {
    title: 'Cyberattack on Power Grid',
    description: 'A coordinated cyberattack has taken down power grids in major tech hubs.',
    severity: 'high',
    impact: {
      global: { economy: -10, stability: -5 },
      regions: { 'North America': { stability: -15 }, 'Europe': { stability: -10 } },
    },
  },
  {
    title: 'Drought in Agricultural Zones',
    description: 'Severe climate-driven drought is affecting crop yields globally.',
    severity: 'medium',
    impact: {
      global: { environment: -10, economy: -5 },
      regions: { 'Asia': { stability: -10 }, 'North America': { stability: -5 } },
    },
  },
  {
    title: 'Diplomatic Summit Fails',
    description: 'Peace talks have broken down, increasing regional tensions and military posturing.',
    severity: 'high',
    impact: {
      global: { stability: -15 },
      regions: { 'Middle East': { stability: -15 } },
    },
  },
  {
    title: 'Renewable Energy Breakthrough',
    description: 'A new solid-state battery tech reduces reliance on fossil fuels.',
    severity: 'low',
    impact: {
      global: { environment: +5, economy: +10, stability: +5 },
    },
  },
];

export function useSimulation() {
  const [globalStats, setGlobalStats] = useState<GlobalStats>(INITIAL_GLOBAL);
  const [regions, setRegions] = useState<Record<Region, RegionStats>>(INITIAL_REGIONS);
  const [events, setEvents] = useState<CrisisEvent[]>([]);
  const [tick, setTick] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  // History for charts
  const [history, setHistory] = useState<{ tick: number; stats: GlobalStats }[]>([]);

  const triggerEvent = useCallback(() => {
    const randomEventTemplate = POSSIBLE_EVENTS[Math.floor(Math.random() * POSSIBLE_EVENTS.length)];
    const newEvent: CrisisEvent = {
      ...randomEventTemplate,
      id: Math.random().toString(36).substring(7),
      timestamp: Date.now(),
    };

    setEvents((prev) => [newEvent, ...prev].slice(0, 10)); // Keep last 10 events

    // Apply impacts
    setGlobalStats((prev) => {
      const next = { ...prev };
      if (newEvent.impact.global) {
        if (newEvent.impact.global.stability) next.stability = Math.max(0, Math.min(100, next.stability + newEvent.impact.global.stability));
        if (newEvent.impact.global.environment) next.environment = Math.max(0, Math.min(100, next.environment + newEvent.impact.global.environment));
        if (newEvent.impact.global.economy) next.economy = Math.max(0, Math.min(100, next.economy + newEvent.impact.global.economy));
      }
      return next;
    });

    const regionsImpact = newEvent.impact.regions;
    if (regionsImpact) {
      setRegions((prev) => {
        const next = { ...prev };
        for (const [regionName, impact] of Object.entries(regionsImpact)) {
          const r = regionName as Region;
          if (next[r] && impact?.stability) {
            next[r] = { ...next[r], stability: Math.max(0, Math.min(100, next[r].stability + impact.stability)) };
          }
        }
        return next;
      });
    }
  }, []);

  // Main game loop
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);

      // Resource consumption and production
      setGlobalStats((prev) => {
        const next = { ...prev };
        
        // Base consumption
        const consumption = {
          Energy: 80,
          Food: 90,
          Technology: 50,
          Materials: 60,
        };

        // Calculate total production from regions based on their stability
        const production = { Energy: 0, Food: 0, Technology: 0, Materials: 0 };
        Object.values(regions).forEach((r) => {
          const efficiency = r.stability / 100;
          production.Energy += r.resourceOutput.Energy * efficiency;
          production.Food += r.resourceOutput.Food * efficiency;
          production.Technology += r.resourceOutput.Technology * efficiency;
          production.Materials += r.resourceOutput.Materials * efficiency;
        });

        // Update stockpiles
        (Object.keys(next.resources) as Resource[]).forEach((res) => {
          next.resources[res] = Math.max(0, next.resources[res] + production[res] - consumption[res]);
        });

        // If resources hit 0, stability drops
        if (next.resources.Energy === 0) next.stability -= 1;
        if (next.resources.Food === 0) next.stability -= 2;

        // Record history
        setHistory((prevHistory) => {
          const newHistory = [...prevHistory, { tick: tick + 1, stats: { ...next } }];
          if (newHistory.length > 20) return newHistory.slice(newHistory.length - 20);
          return newHistory;
        });

        return next;
      });

      // Random chance for an event
      if (Math.random() < 0.15) {
        triggerEvent();
      }

    }, 2000); // Tick every 2 seconds

    return () => clearInterval(interval);
  }, [isRunning, regions, triggerEvent, tick]);

  const toggleSimulation = () => setIsRunning(!isRunning);
  const resetSimulation = () => {
    setIsRunning(false);
    setGlobalStats(INITIAL_GLOBAL);
    setRegions(INITIAL_REGIONS);
    setEvents([]);
    setTick(0);
    setHistory([]);
  };

  return {
    globalStats,
    regions,
    events,
    tick,
    isRunning,
    history,
    toggleSimulation,
    resetSimulation,
    triggerEvent,
  };
}
