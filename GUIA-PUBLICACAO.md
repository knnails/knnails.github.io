# Kelle Nails Design — como publicar (custo 0 €)

Tudo usa contas gratuitas: **Google** (agenda e painel) e **GitHub** (site). Não é preciso comprar domínio nem cartão.

---

## 1. Ligar a agenda (Google Sheets + Apps Script) — ~15 min

1. Entre em <https://sheets.google.com> com a conta Google da Kelle e crie uma folha em branco chamada **Kelle Nails — Agenda**.
2. Menu **Extensões → Apps Script**. Apague o código de exemplo e cole todo o conteúdo de `backend/Code.gs`. Guarde (ícone da disquete).
3. No topo, escolha a função **setup** e clique **Executar**. O Google pede autorização: *Rever permissões → escolher a conta → Avançadas → Ir para o projeto → Permitir*. (O aviso aparece porque o script é seu e não foi verificado pela Google; é normal.)
   - Isto cria as abas `Horarios`, `Bloqueios`, `Reservas`, `Avaliacoes`, `Fotos` e uma pasta no Google Drive para a galeria.
4. Ícone da roda dentada **Definições do projeto → Propriedades do script → Adicionar propriedade**:

   | Propriedade | Valor | Obrigatório? |
   |---|---|---|
   | `ADMIN_PASSWORD` | uma palavra-passe forte para o painel | Sim |
   | `WHATSAPP_NUMBER` | número da Kelle em formato internacional, só dígitos (ex.: `447…`) | Recomendado |
   | `NOTIFY_EMAIL` | e-mail para receber aviso de cada pedido | Opcional |
   | `BOOKING_WINDOW_DAYS` | quantos dias à frente se pode marcar (padrão 60) | Opcional |
   | `MIN_NOTICE_HOURS` | antecedência mínima em horas (padrão 0) | Opcional |

5. **Implementar → Nova implementação → tipo “Aplicação Web”**:
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - Clique **Implementar** e copie a **URL da aplicação Web** (termina em `/exec`).
6. Abra `config.js` e cole essa URL em `API_URL: '…'`.

> Se alterar o `Code.gs` mais tarde: **Implementar → Gerir implementações → lápis → Versão: Nova versão → Implementar**. Assim a URL mantém-se.

### Porque é preciso o `WHATSAPP_NUMBER`
O link `https://wa.me/qr/EEXLUCRIUFDBG1` é um link de código QR: abre a conversa, mas **não aceita mensagem pré-preenchida**. Para a mensagem ir já escrita (nome, contacto, serviço, dia, horário), o WhatsApp exige o formato `https://wa.me/<número>?text=…`.
O número fica guardado só nas propriedades do script (privado) — **não aparece no código nem nas páginas do site**. A cliente só o vê dentro do WhatsApp depois de tocar em “Enviar pedido pelo WhatsApp”, como acontece com qualquer contacto de WhatsApp.
Sem esta propriedade, o site continua a funcionar: mostra a mensagem pronta com o botão **Copiar** e abre o link QR para a cliente colar.

---

## 2. Colocar as imagens

Copie para a pasta `assets/` a logo KN (`logo-kn.png`), a imagem dourada (`kn-dourada.png`) e a fotografia (`profissional.jpg`). Ver `assets/LEIA-ME.txt`.

---

## 3. Publicar o site no GitHub Pages — ~10 min

1. Crie uma conta gratuita em <https://github.com> (ex.: utilizador `kellenailsdesign`).
2. **New repository** → nome `kellenailsdesign.github.io` (troque pelo seu utilizador) → **Public** → *Create*.
3. **Add file → Upload files** → arraste **todo o conteúdo** da pasta do site (`index.html`, `admin.html`, `app.js`, `admin.js`, `i18n.js`, `config.js`, `styles.css`, `robots.txt` e a pasta `assets`). Pode deixar de fora a pasta `backend` e este guia. → *Commit changes*.
4. **Settings → Pages → Branch: main / root → Save**.
5. Em 1–2 minutos o site fica em **https://kellenailsdesign.github.io** (o seu utilizador). Esse endereço é gratuito e permanente, com HTTPS.

Alternativa sem conta GitHub: <https://app.netlify.com/drop> — arraste a pasta e recebe um endereço `…netlify.app` gratuito (crie conta para não expirar).

---

## 4. Usar o painel privado

Abra `https://<o-seu-site>/admin.html` e entre com a `ADMIN_PASSWORD`.

1. **Horários** — escreva as horas de início de cada dia (ex.: `10:00, 13:30`). Cada horário recebe uma única cliente. Sem horários, o site não mostra datas: nada é inventado.
2. **Dias bloqueados** — férias, folgas, dias cheios.
3. **Pedidos** — Confirmar → (no dia) Marcar concluída → Marcar pago. O botão *WhatsApp: confirmar* abre a conversa com a cliente com a mensagem pronta; acrescente o endereço completo à mão (o endereço nunca está no site).
4. **Galeria** — só lista atendimentos concluídos com autorização. A fotografia fica pendente até carregar em *Aprovar*. Se a cliente retirar a autorização no site, a fotografia sai logo da galeria e vai para o lixo do Drive.
5. **Avaliações** — só clientes com atendimento **concluído** conseguem avaliar (código + WhatsApp). Só pode publicar as que a cliente autorizou; o nome nunca aparece.
6. **Indicações** — quando o atendimento indicado (alongamento em fibra) está concluído e pago, aparece “Recompensa disponível para: …”; marque quando entregar.

A folha do Google é a “base de dados”: pode consultá-la a qualquer momento. Não altere os títulos das colunas.

---

## O que é real e o que depende de configuração

| Função | Estado |
|---|---|
| Site PT / EN, telemóvel/tablet/computador | Pronto |
| Botões WhatsApp, Instagram, Agendar, Ver trabalhos | Prontos |
| Calendário com horários realmente livres, sem duplicados | Real depois do passo 1 |
| Pedido chega à profissional | Pela mensagem de WhatsApp que a **cliente envia** (um toque). Aviso automático por e-mail se `NOTIFY_EMAIL` estiver definido. Todos os pedidos ficam também no painel. |
| Mensagem já preenchida no WhatsApp | Requer `WHATSAPP_NUMBER` |
| Confirmação à cliente | Manual, pela profissional, no WhatsApp (o site nunca confirma sozinho) |
| Galeria, avaliações, autorizações, indicações | Reais depois do passo 1 |
| Fotografia, logo, imagem dourada | Aguardam os ficheiros originais |
| Serviços | Alongamento em fibra (mãos), Shellac, Francesinha, Cutilagem (só mãos, só pés, mãos e pés). Sem Nail Art. |
| Preços | Não publicados (“sob consulta”) até a Kelle os definir |

Limites gratuitos do Google Apps Script chegam com folga para um espaço de manicure (milhares de pedidos por dia).
