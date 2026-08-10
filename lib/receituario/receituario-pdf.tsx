/**
 * Receituário Oficial Be4Hope — @react-pdf/renderer
 * Layout idêntico ao modelo aprovado pelo MKT em 10/08/2026.
 * Funciona em qualquer ambiente Node.js: localhost, Vercel, AWS EC2.
 * Sem Chrome, sem Puppeteer, sem timeout.
 *
 * Ver: docs/DECISOES_TECNICAS.md DT-001
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Link,
  pdf,
} from '@react-pdf/renderer';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface MedicamentoReceituario {
  nome: string;
  dose?: string;
  forma?: string;
  posologia?: string;
  quantidade?: string;
  usoContinuo?: boolean;
}

export interface DadosReceituario {
  // Médico
  medicoNome: string;
  medicoCrm: string;
  medicoEspecialidade: string;
  medicoRqe?: string;
  medicoEndereco?: string;

  // Paciente
  pacienteNome: string;
  pacienteNascimento?: string;
  pacienteCpf?: string;
  pacienteEndereco?: string;
  pacienteCep?: string;
  pacienteCidade?: string;
  pacienteUf?: string;

  // Receita
  tipo: 'simples' | 'controle_especial' | 'personalizado';
  medicamentos: MedicamentoReceituario[];
  emissao: string;      // formato: dd/mm/yyyy - HH:MM
  validade?: string;

  // ICP-Brasil
  tokenReceita?: string;     // ex: XXXXXXX
  codigoAcesso?: string;     // ex: 0000
  assinadoDigitalmente?: boolean;
  medicoAssinaturaTexto?: string; // "por Dr(a). nome em dd/mm/yyyy - HH:MM"
}

// ── Constantes ───────────────────────────────────────────────────────────────

const LARANJA = '#EA5429';
const PRETO = '#1a1a1a';
const CINZA_LABEL = '#666666';
const CINZA_BORDA = '#cccccc';
const BRANCO = '#ffffff';

// ── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: PRETO,
    backgroundColor: BRANCO,
    paddingTop: 28,
    paddingBottom: 28,
    paddingHorizontal: 32,
  },

  // Logo
  logoContainer: {
    marginBottom: 12,
  },
  logoTexto: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: LARANJA,
    lineHeight: 1,
  },
  logoPonto: {
    fontSize: 22,
    color: LARANJA,
  },
  logoHope: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: PRETO,
  },

  // Título
  titulo: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: PRETO,
    textAlign: 'left',
    marginBottom: 10,
    letterSpacing: 0.5,
  },

  // Via farmácia
  viaFarmacia: {
    fontSize: 8,
    color: CINZA_LABEL,
    textAlign: 'right',
    marginBottom: 6,
  },

  // Linha divisória
  divisoria: {
    borderBottomWidth: 1,
    borderBottomColor: CINZA_BORDA,
    marginVertical: 10,
  },

  // Bloco superior — 2 colunas
  blocoSuperior: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },

  // Coluna emitente (esquerda)
  colunaEmitente: {
    flex: 1,
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    padding: 8,
  },
  labelEmitente: {
    fontSize: 7,
    textTransform: 'uppercase',
    color: CINZA_LABEL,
    letterSpacing: 0.5,
    marginBottom: 10,
    textAlign: 'center',
  },
  medicoNome: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  medicoCrm: {
    fontSize: 8,
    color: CINZA_LABEL,
    marginBottom: 6,
  },
  medicoEndereco: {
    fontSize: 8,
    color: CINZA_LABEL,
    textAlign: 'center',
  },

  // Coluna QR + dados paciente (direita)
  colunaQr: {
    flex: 1,
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    padding: 8,
  },
  qrTextoContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 8,
  },
  qrTexto: {
    flex: 1,
    fontSize: 8,
    color: PRETO,
    lineHeight: 1.4,
  },
  qrImagemContainer: {
    alignItems: 'flex-end',
  },
  qrPlaceholder: {
    width: 50,
    height: 50,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderTexto: {
    fontSize: 6,
    color: CINZA_LABEL,
    textAlign: 'center',
  },
  tokenContainer: {
    marginLeft: 4,
  },
  tokenLabel: {
    fontSize: 7,
    color: CINZA_LABEL,
  },
  tokenValor: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },

  // Dados do paciente (na coluna direita, abaixo do QR)
  dadosPaciente: {
    marginTop: 4,
  },
  dadoLinha: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dadoLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    minWidth: 80,
  },
  dadoValor: {
    fontSize: 8,
    flex: 1,
  },

  // Medicamentos
  medicamentoBloco: {
    marginBottom: 12,
  },
  medicamentoNome: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  medicamentoPosologia: {
    fontSize: 8,
    color: PRETO,
    marginBottom: 1,
  },
  medicamentoQtd: {
    fontSize: 8,
    color: CINZA_LABEL,
    marginBottom: 1,
  },
  usoContinuo: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },

  // ICP-Brasil
  icpContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginVertical: 10,
    gap: 6,
  },
  icpBadge: {
    borderWidth: 1,
    borderColor: PRETO,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  icpBadgeTexto: {
    fontSize: 5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    lineHeight: 1.2,
  },
  icpTexto: {
    fontSize: 7,
    color: CINZA_LABEL,
    flex: 1,
    lineHeight: 1.4,
  },

  // Rodapé — 2 colunas comprador/fornecedor
  rodapeContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  rodapeColuna: {
    flex: 1,
    borderWidth: 1,
    borderColor: CINZA_BORDA,
    padding: 8,
  },
  rodapeTitulo: {
    fontSize: 7,
    textTransform: 'uppercase',
    color: CINZA_LABEL,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  rodapeLinha: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  rodapeLabel: {
    fontSize: 7,
    color: PRETO,
    minWidth: 50,
  },
  rodapeUnderline: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: PRETO,
    marginLeft: 2,
  },
  assinaturaLinha: {
    borderBottomWidth: 0.5,
    borderBottomColor: PRETO,
    marginBottom: 4,
    marginTop: 16,
  },
  assinaturaLabel: {
    fontSize: 7,
    color: CINZA_LABEL,
    textAlign: 'center',
    marginBottom: 14,
  },

  // Última linha
  ultimaLinha: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ultimaLinhaTexto: {
    fontSize: 7,
    color: PRETO,
  },
  ultimaLinhaLink: {
    fontSize: 7,
    color: LARANJA,
    textDecoration: 'underline',
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function tipoLabel(tipo: string): string {
  const mapa: Record<string, string> = {
    simples: 'RECEITUÁRIO',
    controle_especial: 'RECEITUÁRIO CONTROLE ESPECIAL',
    personalizado: 'RECEITUÁRIO',
  };
  return mapa[tipo] ?? 'RECEITUÁRIO';
}

// ── Logo Be4Hope (texto estilizado) ──────────────────────────────────────────

const LogoBeHope = () => (
  <View style={s.logoContainer}>
    <Text style={s.logoTexto}>
      be.<Text style={s.logoPonto}></Text>
      {'\n'}
      <Text style={s.logoHope}>4hope</Text>
    </Text>
  </View>
);

// ── Componente principal ─────────────────────────────────────────────────────

const ReceituarioDocument = ({ dados }: { dados: DadosReceituario }) => {
  const crmCompleto = [
    `CRM ${dados.medicoCrm}`,
    dados.medicoEspecialidade,
    dados.medicoRqe ? `RQE ${dados.medicoRqe}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const assinadoTexto = dados.medicoAssinaturaTexto
    ?? `por ${dados.medicoNome} em ${dados.emissao}`;

  return (
    <Document
      title={`${tipoLabel(dados.tipo)} — ${dados.pacienteNome}`}
      author="Be4Hope"
    >
      <Page size="A4" style={s.page}>

        {/* Logo */}
        <LogoBeHope />

        {/* Título */}
        <Text style={s.titulo}>{tipoLabel(dados.tipo)}</Text>

        {/* Via farmácia */}
        <Text style={s.viaFarmacia}>1° via da farmácia | 2° via do paciente</Text>

        {/* Bloco superior — 2 colunas */}
        <View style={s.blocoSuperior}>

          {/* Coluna esquerda — Identificação do Emitente */}
          <View style={s.colunaEmitente}>
            <Text style={s.labelEmitente}>IDENTIFICAÇÃO DO EMITENTE</Text>
            <Text style={s.medicoNome}>{dados.medicoNome}</Text>
            <Text style={s.medicoCrm}>{crmCompleto}</Text>
            {dados.medicoEndereco ? (
              <Text style={s.medicoEndereco}>{dados.medicoEndereco}</Text>
            ) : null}
          </View>

          {/* Coluna direita — QR Code + Dados do paciente */}
          <View style={s.colunaQr}>

            {/* QR + Token */}
            <View style={s.qrTextoContainer}>
              <Text style={s.qrTexto}>
                Sua receita foi enviada para o seu celular e pode ser acessada pelo{' '}
                <Text style={{ fontFamily: 'Helvetica-Bold' }}>QRCode</Text>{'\n'}
                Acesse e aproveite as vantagens
              </Text>
              <View style={s.qrImagemContainer}>
                {/* QR Code placeholder — substituir por imagem real quando ICP-Brasil ativo */}
                <View style={s.qrPlaceholder}>
                  <Text style={s.qrPlaceholderTexto}>QR{'\n'}Code</Text>
                </View>
                <View style={s.tokenContainer}>
                  <Text style={s.tokenLabel}>Token da receita:</Text>
                  <Text style={s.tokenValor}>{dados.tokenReceita ?? 'XXXXXXX'}</Text>
                  <Text style={s.tokenLabel}>Código de acesso:</Text>
                  <Text style={s.tokenValor}>{dados.codigoAcesso ?? '0000'}</Text>
                </View>
              </View>
            </View>

            {/* Dados do paciente */}
            <View style={s.dadosPaciente}>
              <View style={s.dadoLinha}>
                <Text style={s.dadoLabel}>Emissão:</Text>
                <Text style={s.dadoValor}>{dados.emissao}</Text>
              </View>
              <View style={s.dadoLinha}>
                <Text style={s.dadoLabel}>Paciente:</Text>
                <Text style={s.dadoValor}>{dados.pacienteNome}</Text>
              </View>
              {dados.pacienteNascimento ? (
                <View style={s.dadoLinha}>
                  <Text style={s.dadoLabel}>Nascimento:</Text>
                  <Text style={s.dadoValor}>{dados.pacienteNascimento}</Text>
                </View>
              ) : null}
              {dados.pacienteCpf ? (
                <View style={s.dadoLinha}>
                  <Text style={s.dadoLabel}>CPF do Paciente:</Text>
                  <Text style={s.dadoValor}>{dados.pacienteCpf}</Text>
                </View>
              ) : null}
              {dados.pacienteEndereco ? (
                <View style={s.dadoLinha}>
                  <Text style={s.dadoLabel}>Endereço:</Text>
                  <Text style={s.dadoValor}>{dados.pacienteEndereco}</Text>
                </View>
              ) : null}
              {dados.pacienteCep ? (
                <View style={s.dadoLinha}>
                  <Text style={s.dadoLabel}>Cep:</Text>
                  <Text style={s.dadoValor}>
                    {dados.pacienteCep}
                    {dados.pacienteCidade ? `, ${dados.pacienteCidade}` : ''}
                    {dados.pacienteUf ? ` - ${dados.pacienteUf}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Linha divisória */}
        <View style={s.divisoria} />

        {/* Medicamentos */}
        {dados.medicamentos.map((med, i) => (
          <View key={i} style={s.medicamentoBloco}>
            <Text style={s.medicamentoNome}>
              {med.nome}
              {med.dose ? ` com ${med.dose}` : ''}
              {med.forma ? ` em ${med.forma}` : ''}
              {med.quantidade ? ` (${med.quantidade})` : ''}
            </Text>
            {med.posologia ? (
              <Text style={s.medicamentoPosologia}>{med.posologia}</Text>
            ) : null}
            {med.usoContinuo !== false ? (
              <Text style={s.usoContinuo}>Uso Contínuo</Text>
            ) : null}
          </View>
        ))}

        {/* Linha divisória */}
        <View style={s.divisoria} />

        {/* ICP-Brasil */}
        <View style={s.icpContainer}>
          <View style={s.icpBadge}>
            <Text style={s.icpBadgeTexto}>ICP{'\n'}Brasil</Text>
          </View>
          <Text style={s.icpTexto}>
            Importante: Verifique a autenticidade e integridade do documento em:{' '}
            validar.iti.gov.br Assinado digitalmente conforme ICP-Brasil (MP 2.200-2/2001){' '}
            {assinadoTexto}
          </Text>
        </View>

        {/* Rodapé — 2 colunas */}
        <View style={s.rodapeContainer}>

          {/* Identificação do Comprador */}
          <View style={s.rodapeColuna}>
            <Text style={s.rodapeTitulo}>IDENTIFICAÇÃO DO COMPRADOR</Text>
            {[
              { label: 'Nome:' },
              { label: 'Ident.:' },
              { label: 'End.:' },
              { label: 'Cidade:' },
              { label: 'Telefone:' },
            ].map((item, i) => (
              <View key={i} style={s.rodapeLinha}>
                <Text style={s.rodapeLabel}>{item.label}</Text>
                <View style={s.rodapeUnderline} />
                {item.label === 'Ident.:' ? (
                  <>
                    <Text style={[s.rodapeLabel, { marginLeft: 6 }]}>Órg. Emissor:</Text>
                    <View style={s.rodapeUnderline} />
                  </>
                ) : null}
              </View>
            ))}
          </View>

          {/* Identificação do Fornecedor */}
          <View style={s.rodapeColuna}>
            <Text style={s.rodapeTitulo}>IDENTIFICAÇÃO DO FORNECEDOR</Text>
            <View style={s.assinaturaLinha} />
            <Text style={s.assinaturaLabel}>Assinatura do farmacêutico</Text>
            <View style={s.assinaturaLinha} />
            <Text style={s.assinaturaLabel}>Data</Text>
          </View>
        </View>

        {/* Última linha */}
        <View style={s.ultimaLinha}>
          <Text style={s.ultimaLinhaTexto}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Farmacêutico,</Text>
            {' '}valide a receita digital em{' '}
          </Text>
          <Link src="https://farmacias.mevosaude.com.br" style={s.ultimaLinhaLink}>
            https://farmacias.mevosaude.com.br
          </Link>
        </View>

      </Page>
    </Document>
  );
};

// ── Exportação ───────────────────────────────────────────────────────────────

/**
 * Gera o PDF do receituário como Buffer.
 * Funciona em qualquer ambiente Node.js sem Chrome.
 */
export async function gerarPdfReceituario(dados: DadosReceituario): Promise<Buffer> {
  const blob = await pdf(<ReceituarioDocument dados={dados} />).toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
