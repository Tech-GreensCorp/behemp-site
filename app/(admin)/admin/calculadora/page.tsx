'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function CalculadoraDosagemPage() {
  const [volume, setVolume] = useState<number>(30);
  const [gotasPorMl, setGotasPorMl] = useState<number>(30);
  const [gotasDia, setGotasDia] = useState<number>(10);

  const gotasTotais = volume * gotasPorMl;
  const diasDuracao = gotasDia > 0 ? Math.floor(gotasTotais / gotasDia) : 0;
  const mlPorDia = gotasDia > 0 ? (gotasDia / gotasPorMl).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-verde-musgo">
          Calculadora de Dosagem
        </h1>
        <p className="text-muted-foreground">
          Simule posologias e preveja a duração do frasco para orientar seus pacientes.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-terracota/20 shadow-sm">
          <CardHeader className="bg-creme/30 border-b border-terracota/10">
            <CardTitle className="text-xl text-verde-musgo">Parâmetros do Produto</CardTitle>
            <CardDescription>
              Ajuste as características do frasco e a prescrição diária.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="volume">Volume do Frasco (mL)</Label>
              <Input 
                id="volume" 
                type="number" 
                min="1" 
                value={volume} 
                onChange={(e) => setVolume(Number(e.target.value))}
                className="bg-creme/20 border-terracota/30 focus-visible:ring-verde-musgo"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gotasPorMl">Gotas por mL (depende da densidade/marca)</Label>
              <Input 
                id="gotasPorMl" 
                type="number" 
                min="1" 
                value={gotasPorMl} 
                onChange={(e) => setGotasPorMl(Number(e.target.value))}
                className="bg-creme/20 border-terracota/30 focus-visible:ring-verde-musgo"
              />
              <p className="text-xs text-muted-foreground">
                Dica: Óleos BeHemp costumam ter 30 gotas/mL.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gotasDia">Posologia Diária (Total de Gotas/Dia)</Label>
              <Input 
                id="gotasDia" 
                type="number" 
                min="1" 
                value={gotasDia} 
                onChange={(e) => setGotasDia(Number(e.target.value))}
                className="bg-creme/20 border-terracota/30 focus-visible:ring-verde-musgo"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-verde-musgo text-creme shadow-lg flex flex-col justify-center">
          <CardHeader>
            <CardTitle className="text-2xl text-center text-creme">Resultado da Projeção</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 flex flex-col items-center justify-center pt-6">
            
            <div className="text-center">
              <p className="text-creme/80 mb-2">Total no frasco</p>
              <div className="text-4xl font-bold font-fraunces text-terracota">
                {gotasTotais} gotas
              </div>
            </div>

            <div className="text-center">
              <p className="text-creme/80 mb-2">Duração estimada do tratamento</p>
              <div className="text-6xl font-bold font-fraunces text-terracota drop-shadow-md">
                {diasDuracao} dias
              </div>
            </div>

            <div className="text-center">
              <p className="text-creme/80 mb-2">Consumo diário em mL</p>
              <div className="text-2xl font-bold font-fraunces text-creme">
                {mlPorDia} mL / dia
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
