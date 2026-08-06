'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { MedicoCard } from './medico-card';

interface MedicosCarouselProps {
  medicos: Array<{
    id: string;
    nome: string;
    especialidade: string;
    avatarUrl: string | null;
    crm: string | null;
  }>;
}

export function MedicosCarousel({ medicos }: MedicosCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const updateCount = () => {
      const width = window.innerWidth;
      if (width < 640) {
        setVisibleCount(1);
      } else if (width < 1024) {
        setVisibleCount(2);
      } else if (width < 1280) {
        setVisibleCount(3);
      } else {
        setVisibleCount(4);
      }
    };

    updateCount();
    window.addEventListener('resize', updateCount);
    return () => window.removeEventListener('resize', updateCount);
  }, []);

  const maxIndex = Math.max(0, medicos.length - visibleCount);

  // Cap the index when visibleCount changes
  useEffect(() => {
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex);
    }
  }, [visibleCount, maxIndex, currentIndex]);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  };

  if (!medicos || medicos.length === 0) {
    return null;
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto px-4 md:px-12">
      {/* Slide Viewport Wrapper */}
      <div className="relative overflow-hidden py-4 px-1">
        {/* Left Side Soft Gradient Fade */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#F5F2ED] via-[#F5F2ED]/60 to-transparent z-10 pointer-events-none hidden md:block" />
        {/* Right Side Soft Gradient Fade */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#F5F2ED] via-[#F5F2ED]/60 to-transparent z-10 pointer-events-none hidden md:block" />

        {/* Slide Track */}
        <div
          className="flex transition-transform duration-500 ease-out items-stretch"
          style={{
            transform: `translateX(-${currentIndex * (100 / visibleCount)}%)`,
          }}
        >
          {medicos.map((medico) => (
            <div
              key={medico.id}
              className="w-full sm:w-1/2 lg:w-1/3 xl:w-1/4 shrink-0 px-3 flex flex-col items-stretch"
            >
              <MedicoCard
                nome={medico.nome}
                avatarUrl={medico.avatarUrl}
                especialidade={medico.especialidade}
                crm={medico.crm}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Controls (Floating Premium Arrows) */}
      {maxIndex > 0 && (
        <>
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`absolute left-0 md:-left-2 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-[#2D4F3C]/10 text-[#2D4F3C] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
              currentIndex === 0 
                ? 'opacity-30 cursor-not-allowed border-gray-200' 
                : 'hover:bg-[#EA5429] hover:text-white hover:border-[#EA5429] hover:shadow-xl hover:shadow-orange-100/50'
            }`}
            aria-label="Médico anterior"
          >
            <ChevronLeft size={22} className="stroke-[2.5]" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === maxIndex}
            className={`absolute right-0 md:-right-2 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-lg border border-[#2D4F3C]/10 text-[#2D4F3C] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${
              currentIndex === maxIndex 
                ? 'opacity-30 cursor-not-allowed border-gray-200' 
                : 'hover:bg-[#EA5429] hover:text-white hover:border-[#EA5429] hover:shadow-xl hover:shadow-orange-100/50'
            }`}
            aria-label="Próximo médico"
          >
            <ChevronRight size={22} className="stroke-[2.5]" />
          </button>
        </>
      )}

      {/* Pagination Indicators (Premium Dots) */}
      {maxIndex > 0 && (
        <div className="mt-8 flex justify-center gap-2.5">
          {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer shadow-sm ${
                currentIndex === idx ? 'w-8 bg-[#EA5429]' : 'w-2 bg-[#DDD8D1] hover:bg-[#C69B7B]'
              }`}
              aria-label={`Ir para o slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
