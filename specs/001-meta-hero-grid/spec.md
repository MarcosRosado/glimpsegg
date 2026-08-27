# Feature Specification: Layout espelho de heróis ordenado por winrate do meta

**Feature Branch**: `001-meta-hero-grid`

**Created**: 2026-08-26

**Status**: Draft

**Input**: User description: "nesse projeto tenho um app que captura status de pós jogo do stratz, quero agora que ele expanda por winrate no dota 2 pro tracker e stratz/opendota para ordenar o meu loadout do dota 2 com base em winrate dos personagens, levando em consideração o layout que eu já possuo. Seguindo um pouco os moldes do projeto https://github.com/maybewewill/metagrid. essa opção deve ser opcional, por default desmarcada nos configs, ativando ela deve criar um processo em background que sincronize 1 vez por dia"

## Contexto

Hoje o app é um analisador pós-jogo: o jogador escolhe uma partida e recebe diagnóstico. Esta
feature acrescenta um segundo momento de uso — **antes** da partida, na tela de seleção de heróis do
Dota 2. O app passa a gerar um **layout espelho** do loadout do jogador (o que o Dota 2 chama de grid
de heróis): mesma estrutura, mesmos grupos, mesmos nomes, mesmos heróis — mas com a ordem interna de
cada grupo definida pelo winrate do meta atual. O layout que o jogador montou à mão **não é
alterado**; o espelho entra como um layout adicional, ao lado dele. Na tela de escolha de heróis o
jogador alterna entre os dois: o dele, do jeito que ele deixou, e a versão ordenada.

A referência declarada é o MetaGrid: ele lê estatísticas de meta de alto MMR e reescreve o arquivo
de layout de heróis que o próprio Dota 2 usa, com backup e modo de mesclagem para não destruir
grids feitos à mão. Esta feature segue esse molde, com três diferenças de intenção:

1. **Múltiplas fontes com procedência explícita** — STRATZ e OpenDota, cada número carregando de
   onde veio e sobre quantas partidas, coerente com a doutrina do projeto de nunca apresentar
   estimativa como medição. Fonte que não entrega winrate **e** amostra não entra.
2. **Opt-in real** — desligada por padrão. Nada é lido, escrito ou sincronizado até o jogador
   marcar a opção.
3. **Ranking combinado** — o meta do patch como base, ajustado pelo histórico do próprio jogador,
   com o peso do dado pessoal reduzido quando a amostra dele é pequena.
4. **Original intocado** — em vez de reescrever o layout do jogador, a feature mantém um espelho
   separado. O trabalho manual dele não corre risco nenhum de ser sobrescrito.

O que a feature **não** faz: alterar o layout de origem, inventar grupos que não existem nele,
acrescentar ou remover heróis, e mexer em qualquer outro layout da coleção.

## Clarifications

### Session 2026-08-26

- Q: O Dota 2 Pro Tracker só publica a ordem dos heróis no meta, sem winrate e sem número de
  partidas — como a feature deve tratar um dado sem amostra, dado que a spec exige que todo número
  que ordena carregue fonte e amostra? (FR-014, FR-015) → A: Cortar o Dota 2 Pro Tracker da v1. Só
  STRATZ + OpenDota, ambas com winrate e amostra. Aceita-se perder o recorte de alto MMR em troca de
  toda fonte respeitar a regra de procedência sem exceção.
- Q: Quando você pediu "um processo em background que sincronize 1 vez por dia", isso precisa
  funcionar com o GlimpseGG fechado, ou basta sincronizar enquanto o app estiver aberto?
  (FR-022, FR-023, FR-024) → A: Só com o app aberto. "Background" significa em segundo plano dentro
  do app, não serviço do sistema operacional. Nenhum autostart, nenhuma bandeja, nenhum modo
  headless.
- Q: Seus grupos do grid se chamam `Hcs Principais`, `Supps secundários` — como o app deve descobrir a
  qual posição do jogo cada grupo corresponde, sabendo que o winrate muda muito entre pos 1 e pos 5?
  (FR-034) → A: Ignorar posição. Todo grupo é ordenado pelo winrate **geral** do herói. Sem
  mapeamento manual e sem heurística de nome. Aceita-se perder o recorte por função em troca de não
  ter uma classe de erro invisível.
- Q: Com o D2PT cortado e o recorte por posição removido, a STRATZ e a OpenDota passam a entregar a
  mesma coisa (winrate por ranque) — qual deve prevalecer quando ambas têm dado para o mesmo herói?
  (FR-013, FR-015, FR-016) → A: Inverter a precedência para OpenDota → STRATZ. As duas fontes
  permanecem, então a degradação de FR-016/FR-017 continua real, mas a que não exige token vem
  primeiro. A STRATZ preenche herói ausente na OpenDota e serve de segunda medição.
- Q: A feature funciona para qualquer organização de grupos, ou só para o grid do autor? → A: A
  ordenação é agnóstica por construção (copia a categoria e só reordena a lista), mas a revisão
  encontrou três acoplamentos ao grid do autor: identidade de layout e de grupo dependendo do
  **nome**, ausência de tratamento para nomes repetidos, e fixture de um único layout tornando
  FR-007a intestável. Resolvido com FR-008h, FR-008i e os casos de borda novos.
- Q: SC-003 exige que o layout de origem fique "byte a byte" idêntico, mas gravar o arquivo reescreve
  a serialização inteira — qual garantia no lugar? (SC-003, FR-007, FR-010) → A: Garantia dupla —
  igualdade profunda do config de origem verificada por asserção antes de gravar (aborta se divergir)
  e backup byte a byte do arquivo anterior. Mais um serializador que imita o estilo da Valve (tabs, 6
  decimais) para o diff ficar mínimo e revisável.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ligar a feature e ganhar um layout espelho ordenado (Priority: P1)

O jogador abre as configurações, encontra a opção desmarcada, marca ela, escolhe qual dos seus
layouts serve de origem e confirma. O app faz uma cópia de segurança da coleção de layouts, busca os
winrates do meta atual, combina com o histórico do jogador e **acrescenta um layout novo** — cópia
fiel do de origem em grupos, nomes e alocação de heróis, com a ordem interna de cada grupo definida
pelo ranking. Na próxima vez que o jogador abre o Dota 2, ele tem dois layouts: o dele, exatamente
como deixou, e o espelho ordenado.

**Why this priority**: é o valor inteiro da feature em uma passada. Sem isso nada mais importa.

**Independent Test**: com a feature desmarcada, marcar a opção, escolher um layout de origem e
sincronizar; verificar que (a) o layout de origem está igual em profundidade ao que era antes — mesmos
grupos, nomes, coordenadas e ordem de heróis —, (b) existe um layout novo com os mesmos grupos, nomes
e conjunto de heróis por grupo, (c) a ordem interna
de cada grupo do espelho corresponde ao ranking exibido no app, (d) nenhum outro layout da coleção
mudou.

**Acceptance Scenarios**:

1. **Given** a feature desmarcada e um layout de heróis com grupos próprios, **When** o jogador marca
   a opção, escolhe esse layout como origem e confirma, **Then** o app cria backup da coleção,
   acrescenta o layout espelho ordenado e informa quantos heróis foram ordenados e de quais fontes
   vieram os dados.
2. **Given** uma sincronização concluída, **When** o jogador compara o layout de origem com o que
   tinha antes, **Then** eles são idênticos — grupos, nomes, ordem dos heróis, tudo.
3. **Given** a feature ativa e uma sincronização concluída, **When** o jogador abre a tela da feature
   no app, **Then** ele vê a lista de heróis ordenada, o winrate de cada um, a fonte de cada número e
   o horário da última sincronização.
4. **Given** a feature ativa e um espelho já existente, **When** uma nova sincronização roda,
   **Then** o app atualiza **o mesmo** layout espelho em vez de criar outro, e a coleção continua com
   exatamente um espelho.
5. **Given** a feature ativa, **When** o jogador desmarca a opção, **Then** o app para de sincronizar
   e oferece remover o layout espelho, deixando claro que o layout de origem nunca foi tocado.
6. **Given** que o jogador editou o layout de origem entre duas sincronizações (renomeou grupo, moveu
   herói), **When** a sincronização seguinte roda, **Then** o espelho passa a refletir a nova
   estrutura de origem, mantendo a ordenação por winrate.

---

### User Story 2 - Sincronização diária em background (Priority: P2)

Com a feature ativa, o app sincroniza os winrates uma vez por dia sem o jogador pedir. Se o app
estava fechado no horário previsto, a sincronização acontece na primeira abertura seguinte. O
jogador consegue ver quando foi a última sincronização, quando é a próxima, e disparar uma
sincronização manual.

**Why this priority**: sem isso a ordenação envelhece e passa a mentir sobre o meta. É o que
transforma a feature de "ação pontual" em serviço. Mas depende da US1 existir.

**Independent Test**: ativar a feature, forçar o relógio de controle para mais de 24h atrás, reabrir
o app e verificar que uma sincronização ocorreu sozinha e que o registro de última sincronização foi
atualizado.

**Acceptance Scenarios**:

1. **Given** a feature ativa e última sincronização há mais de 24h, **When** o app é aberto, **Then**
   uma sincronização é disparada automaticamente e o layout é atualizado se os dados mudaram.
2. **Given** a feature ativa e última sincronização há 3h, **When** o app é aberto, **Then** nenhuma
   sincronização automática ocorre e o app mostra o horário previsto da próxima.
3. **Given** a feature ativa e o app aberto continuamente por mais de 24h, **When** o momento da
   próxima sincronização chega, **Then** ela ocorre sem o jogador reabrir o app.
4. **Given** a feature desmarcada, **When** o app é aberto ou fica aberto por dias, **Then** nenhuma
   sincronização ocorre e nenhuma requisição às fontes de meta é feita.

---

### User Story 3 - Transparência de fonte e degradação honesta (Priority: P2)

Cada herói ordenado mostra de onde veio seu winrate e sobre quantas partidas. Quando uma fonte está
indisponível, o app sincroniza com as fontes restantes e diz explicitamente qual faltou, em vez de
silenciosamente misturar dados de qualidades diferentes. Quando nenhuma fonte responde, o layout
anterior é mantido intacto.

**Why this priority**: é a doutrina do projeto aplicada aqui. Um ranking sem procedência é
indistinguível de um chute, e a feature toca um arquivo que o jogador criou à mão.

**Independent Test**: simular indisponibilidade de cada fonte, uma por vez e todas juntas, e
verificar a mensagem exibida e o estado final da coleção de layouts.

**Acceptance Scenarios**:

1. **Given** a feature ativa e uma das fontes fora do ar, **When** a sincronização roda, **Then** ela
   conclui usando as fontes disponíveis, marca os heróis afetados com a fonte efetivamente usada e
   avisa qual fonte faltou.
2. **Given** nenhuma fonte disponível, **When** a sincronização roda, **Then** a coleção de layouts
   não é modificada (nem a origem, nem o espelho), o horário de última sincronização bem-sucedida não
   é alterado e o jogador é avisado da falha.
3. **Given** um herói sem dado de winrate em nenhuma fonte, **When** a ordenação é aplicada, **Then**
   ele é mantido no espelho, posicionado depois dos heróis com dado no grupo dele, e sinalizado como
   "sem dado" na tela — não recebe winrate presumido nem é omitido.
4. **Given** um winrate calculado sobre amostra pequena, **When** ele é exibido e usado na ordenação,
   **Then** a amostra é mostrada ao jogador e o herói não é promovido ao topo apenas por ter poucos
   jogos com resultado favorável.

---

### User Story 4 - Trocar o critério de ordenação (Priority: P3)

O critério padrão já é o combinado (meta do patch ajustado pelo histórico do jogador). Nesta história
o jogador passa a poder **trocar** esse critério: usar só o meta geral, usar só o desempenho pessoal
dele, e escolher o ranque de referência.

**Why this priority**: o critério combinado já entrega o valor na US1. Isto é ajuste fino para quem
quer um recorte diferente — útil, mas ninguém fica sem a feature por não ter.

**Independent Test**: alternar o critério entre as opções e verificar que a ordem exibida muda de
forma consistente com o critério escolhido, com o rótulo do critério visível na tela.

**Acceptance Scenarios**:

1. **Given** o critério combinado (padrão), **When** o jogador troca para "só meta geral", **Then** a
   ordem é recalculada ignorando o histórico pessoal e a tela indica o critério ativo.
2. **Given** o critério combinado, **When** o jogador troca para "só desempenho pessoal", **Then** a
   ordem vem do histórico dele, a tela mostra o tamanho da amostra pessoal por herói e heróis que ele
   nunca jogou aparecem como "sem dado" em vez de recuar para o meta silenciosamente.
3. **Given** um ranque de referência selecionado que a fonte não sabe segmentar, **When** a
   sincronização roda, **Then** o app usa a média geral e rotula como "média geral", nunca como "no
   seu ranque".
4. **Given** que a OpenDota não devolveu um herói e a STRATZ devolveu, **When** o ranking é montado,
   **Then** aquele herói é rotulado com a fonte STRATZ, e a tela deixa claro que fontes diferentes
   foram usadas em heróis diferentes do mesmo grupo.

---

### Edge Cases

- **Dois grupos com o mesmo nome no layout de origem**: ambos são espelhados e ordenados
  independentemente, cada um na sua posição. O app não funde, não renomeia e não recusa.
- **Dois layouts com o mesmo nome na coleção**: o jogador escolhe qual é a origem sem ambiguidade, e o
  app não confunde um com o outro nas sincronizações seguintes.
- **Jogador renomeia o espelho dentro do Dota 2**: na sincronização seguinte o app continua
  reconhecendo aquele layout como o espelho dele e o atualiza, em vez de criar um segundo (FR-008h).
- **Layout de origem com poucos heróis**: o caso comum. A maioria dos grids tem um punhado de heróis
  por grupo, não o catálogo inteiro — então a maioria dos heróis do ranking cai em "fora do layout de
  origem" (FR-035a), e esse é o caminho normal, não a exceção.
- **Espelho editado à mão pelo jogador**: ele é gerado; a sincronização seguinte descarta as edições
  (FR-008f avisa). Editar o layout de origem é o caminho suportado.
- **Layout de origem apagado ou renomeado pelo jogador**: a feature não tem mais o que espelhar. O app
  avisa, mantém o espelho antigo como está (não o apaga por conta própria) e pede um novo layout de
  origem.
- **Nome do espelho já ocupado** por um layout que o jogador criou: o app não sobrescreve; pede outro
  nome (FR-008e).
- **Layout de origem vazio ou sem grupos**: o espelho é gerado com a mesma estrutura vazia, sem
  inventar grupos.
- **Limite de layouts do cliente do Dota 2**: se acrescentar o espelho exceder o que o cliente aceita,
  o app avisa antes de escrever, em vez de gerar uma coleção que o jogo vai truncar.
- **Dota 2 aberto durante a escrita**: o cliente reescreve o arquivo de layout ao sair e pode
  descartar a alteração. O app precisa detectar essa condição e avisar, ou adiar a escrita, em vez de
  reportar sucesso silencioso sobre uma mudança que será perdida.
- **Várias contas Steam na mesma máquina**: existe mais de um layout candidato. O jogador precisa
  escolher qual conta é a dele; o app não elege sozinho.
- **Layout não encontrado** (Steam instalado em local não padrão, Dota 2 nunca aberto, instalação
  portátil/Flatpak): a feature informa que não localizou o layout e permite ao jogador indicar o
  caminho, sem criar arquivo do zero por conta própria.
- **Sem permissão de escrita** no arquivo de layout: a feature falha explicitamente, mantendo o
  arquivo original.
- **Layout sem nenhum grupo** ou com um grupo só, contendo todos os heróis: a ordenação se aplica ao
  conjunto único.
- **Herói novo de patch** que existe no jogo mas não nas fontes de meta: tratado como "sem dado" (ver
  US3), nunca omitido do espelho.
- **Herói presente no layout de origem que não existe mais no jogo**: copiado para o espelho como
  está, sem winrate; a feature não decide remover entradas que o jogador manteve.
- **Herói forte no meta que não está em nenhum grupo do layout de origem**: a feature não o insere no
  espelho — espelho é espelho. Ele aparece na tela de ranking marcado como "fora do layout de
  origem", para o jogador decidir se quer acrescentá-lo ao layout dele.
- **Jogador sem histórico pessoal** (perfil novo, sem token, poucas partidas): o critério combinado
  recai para o meta geral e a tela diz que o componente pessoal não foi aplicado.
- **Troca de patch entre sincronizações**: dados de meta do patch anterior são considerados vencidos
  e a sincronização seguinte busca dados novos em vez de reaproveitar cache.
- **Máquina hibernada / relógio do sistema alterado**: o controle de "uma vez por dia" não pode
  disparar uma rajada de sincronizações nem travar indefinidamente por causa de salto de relógio.
- **Backups acumulando**: sincronizações diárias por meses não devem encher o disco com backups, nem
  com layouts espelho duplicados (FR-008c).
- **Duas sincronizações concorrentes** (automática e manual ao mesmo tempo): só uma escreve; a outra
  é descartada ou enfileirada, nunca resultando em arquivo pela metade.
- **Fonte de meta responde com bloqueio ou limite de requisições**: tratado como fonte indisponível
  (US3), com espera antes de nova tentativa, sem retentativa agressiva.

## Requirements *(mandatory)*

### Functional Requirements

**Ativação e configuração**

- **FR-001**: A feature MUST existir como opção nas configurações, **desmarcada por padrão** em
  instalação nova e em atualização de versão anterior.
- **FR-002**: Enquanto a opção estiver desmarcada, o app MUST NOT ler o layout de heróis do jogador,
  MUST NOT escrever nele e MUST NOT fazer requisição alguma às fontes de meta.
- **FR-003**: Ao marcar a opção pela primeira vez, o app MUST explicar em uma frase o que vai
  acontecer — um layout novo será acrescentado à conta escolhida e o layout de origem não será
  alterado — e exigir confirmação explícita antes da primeira escrita.
- **FR-004**: O jogador MUST poder desmarcar a opção a qualquer momento; desmarcar interrompe a
  sincronização e MUST oferecer remover o layout espelho, além de manter disponível a restauração da
  coleção a partir do backup mais recente.
- **FR-005**: O jogador MUST poder escolher qual conta Steam da máquina tem os layouts, quando houver
  mais de uma.
- **FR-005a**: O jogador MUST escolher qual dos seus layouts serve de **origem** do espelho. Quando
  houver apenas um, o app MAY pré-selecioná-lo, ainda exigindo a confirmação de FR-003.
- **FR-006**: O jogador MUST poder indicar manualmente o local da coleção de layouts quando a
  detecção automática falhar.

**Layout espelho**

- **FR-007**: O app MUST NOT alterar o layout de origem. Nem ordem, nem nomes, nem grupos, nem
  composição. Uma sincronização que não consiga garantir isso MUST abortar sem escrever.
- **FR-007a**: O app MUST NOT alterar nenhum outro layout da coleção além do espelho que ele mesmo
  criou.
- **FR-007b**: Imediatamente antes de gravar, o app MUST comparar o layout de origem que vai para o
  disco com o que foi lido, por **igualdade profunda**, e MUST abortar a escrita se divergirem. É essa
  asserção que transforma FR-007 de intenção em garantia verificável.
- **FR-007c**: O app MUST gravar o arquivo preservando o estilo de formatação que o arquivo original
  já usava, de modo que a diferença entre antes e depois seja revisável a olho e limitada ao layout
  espelho.
- **FR-008**: O layout espelho MUST reproduzir do layout de origem: a quantidade de grupos, os nomes
  dados pelo jogador, a posição de cada grupo e a alocação de cada herói a seu grupo. A **única**
  diferença permitida é a ordem dos heróis dentro de cada grupo.
- **FR-008a**: O app MUST NOT acrescentar heróis ao espelho que não estejam no layout de origem, e
  MUST NOT omitir heróis que estejam nele.
- **FR-008b**: O layout espelho MUST ter nome próprio, distinguível à primeira vista do layout de
  origem e identificando que foi gerado pelo app.
- **FR-008c**: O app MUST manter **exatamente um** layout espelho por layout de origem. Sincronizações
  seguintes atualizam o espelho existente; MUST NOT acumular cópias a cada dia.
- **FR-008h**: A identidade do layout de origem e do layout espelho MUST sobreviver a renomear.
  Renomear o espelho ou a origem dentro do Dota 2 MUST NOT fazer o app perder o rastro deles nem
  criar um segundo espelho. Nome é rótulo para o jogador, não identidade para o app.
- **FR-008i**: A feature MUST funcionar quando a coleção tem **layouts com nomes iguais** e quando um
  layout tem **grupos com nomes iguais**. Grupo é identificado pela posição dele no layout, nunca pelo
  nome — e nomes repetidos são caso real, não hipótese (o grid de meta publicado pelo Dota 2 Pro
  Tracker repete o mesmo nome de grupo sete vezes num único layout).
- **FR-008d**: Quando o layout de origem mudar (grupo renomeado, herói movido, grupo criado ou
  removido), a sincronização seguinte MUST refletir a nova estrutura no espelho.
- **FR-008e**: Quando o nome pretendido para o espelho já estiver ocupado por um layout que o app não
  criou, o app MUST NOT sobrescrevê-lo; MUST avisar o jogador e pedir outro nome.
- **FR-008f**: O app MUST avisar que o espelho é gerado e que edições manuais nele serão descartadas
  na próxima sincronização.
- **FR-008g**: O jogador MUST poder remover o layout espelho a partir do app, sem editar arquivo à
  mão.
- **FR-009**: O app MUST criar uma cópia de segurança **byte a byte** da coleção de layouts antes de
  cada escrita e MUST permitir restaurá-la em um comando. A cópia é do arquivo original, não uma
  reserialização dele — é o que garante que o jogador sempre pode voltar ao arquivo exato.
- **FR-010**: A escrita MUST ser tudo-ou-nada: uma interrupção no meio do processo não pode deixar a
  coleção de layouts corrompida, nem o espelho pela metade, nem o layout de origem afetado.
- **FR-011**: O app MUST detectar que o Dota 2 está em execução no momento da escrita e MUST avisar o
  jogador de que a alteração pode ser descartada pelo cliente ao sair, oferecendo adiar a escrita.
- **FR-012**: O app MUST garantir que apenas uma escrita ocorra por vez.

**Fontes de dados e procedência**

- **FR-013**: O app MUST obter winrate de heróis da OpenDota e da STRATZ. Essas são as **únicas**
  fontes de winrate da feature.
- **FR-013a**: O app MUST NOT consultar o Dota 2 Pro Tracker. Ele foi cortado do escopo porque
  publica ordem de meta sem winrate e sem tamanho de amostra, o que não satisfaz FR-014.
- **FR-013b**: Fonte de winrate acrescentada no futuro MUST entregar valor de vitória **e** tamanho
  de amostra por herói. Fonte que entrega apenas ordem ou apenas um índice proprietário MUST NOT ser
  usada para ordenar.
- **FR-014**: Todo winrate exibido ou usado na ordenação MUST carregar a fonte de origem e o tamanho
  da amostra, e a interface MUST exibir ambos.
- **FR-015**: O app MUST aplicar uma precedência de fontes fixa e visível ao jogador — **OpenDota →
  STRATZ** — de modo que ele saiba qual fonte prevaleceu para cada herói. Ambas entregam winrate por
  ranque; a OpenDota vem primeiro por ser pública e não exigir token, então a feature funciona sem
  configuração alguma.
- **FR-015a**: A feature MUST funcionar por completo sem o token da STRATZ configurado. Ausência de
  token é fonte indisponível (FR-016), não erro, e MUST NOT bloquear a sincronização.
- **FR-016**: Quando parte das fontes estiver indisponível, o app MUST concluir a sincronização com as
  restantes e MUST informar quais faltaram.
- **FR-017**: Quando nenhuma fonte estiver disponível, o app MUST NOT alterar o layout e MUST NOT
  registrar a tentativa como sincronização bem-sucedida.
- **FR-018**: Herói sem winrate em nenhuma fonte MUST ser sinalizado como "sem dado", mantido no
  layout e ordenado após os heróis com dado. O app MUST NOT atribuir winrate presumido.
- **FR-019**: O app MUST reduzir a influência de amostras pequenas na ordenação, de forma que poucos
  jogos com resultado favorável não coloquem um herói acima de outro com vantagem comprovada em
  amostra grande.
- **FR-020**: Quando o ranque de referência pedido não puder ser atendido pela fonte, o app MUST usar
  a média geral e MUST rotulá-la como média geral — nunca como "no seu ranque".
- **FR-021**: Dados de meta MUST ser considerados vencidos quando o patch do jogo muda.

**Sincronização em background**

- **FR-022**: Com a feature ativa, o app MUST sincronizar automaticamente uma vez por dia, sem ação
  do jogador, **enquanto o app estiver aberto**. "Em segundo plano" significa sem bloquear a
  interface e sem o jogador pedir — não um serviço do sistema operacional.
- **FR-022a**: O app MUST NOT instalar inicialização automática com o sistema, MUST NOT residir na
  bandeja e MUST NOT rodar sem janela. Com o app fechado, não há sincronização.
- **FR-023**: Se o momento previsto passou com o app fechado, a sincronização MUST ocorrer na
  primeira abertura seguinte — uma única vez, não uma por dia perdido.
- **FR-024**: Com o app aberto de forma contínua, a sincronização diária MUST ocorrer sem o jogador
  reabrir o app.
- **FR-024a**: O app MUST informar na tela da feature quantos dias se passaram desde a última
  sincronização bem-sucedida, para que um espelho velho por app fechado seja visível em vez de
  silencioso.
- **FR-025**: A sincronização MUST NOT bloquear a interface: o jogador continua navegando pelo app
  enquanto ela roda.
- **FR-026**: O app MUST exibir horário da última sincronização bem-sucedida, resultado dela
  (sucesso, parcial, falha) e horário previsto para a próxima.
- **FR-027**: O jogador MUST poder disparar uma sincronização manual imediata.
- **FR-028**: Falha de sincronização MUST ser informada ao jogador com o motivo, e a nova tentativa
  MUST respeitar espera crescente entre falhas, sem retentativa em rajada.
- **FR-029**: O app MUST tolerar salto no relógio do sistema (hibernação, ajuste manual, fuso) sem
  disparar múltiplas sincronizações seguidas e sem deixar de sincronizar indefinidamente.

**Critério de ordenação**

- **FR-030**: O critério padrão MUST ser o **combinado**: o winrate do meta do patch como base,
  ajustado pelo desempenho pessoal do jogador com aquele herói. O critério ativo MUST estar visível na
  tela da feature.
- **FR-030a**: No critério combinado, o peso do componente pessoal MUST crescer com o tamanho da
  amostra pessoal e MUST ser desprezível quando ela é muito pequena, de forma que dois ou três jogos
  não desloquem um herói para o topo nem para o fim da lista.
- **FR-030b**: Para cada herói, o app MUST poder mostrar as duas parcelas que formaram a nota — a do
  meta e a pessoal — e o peso aplicado a cada uma. Uma nota combinada sem essa decomposição
  disponível MUST NOT ser exibida.
- **FR-030c**: Quando não houver histórico pessoal utilizável (perfil novo, sem token, ou herói nunca
  jogado), o critério combinado MUST recair para o meta geral daquele herói e a tela MUST indicar que
  o componente pessoal não foi aplicado. O app MUST NOT presumir desempenho pessoal.
- **FR-031**: O jogador MUST poder trocar o critério entre combinado (padrão), só meta geral e só
  desempenho pessoal.
- **FR-032**: Quando o critério considerar desempenho pessoal, o app MUST usar o histórico do perfil
  já configurado no app e MUST exibir o tamanho dessa amostra por herói.
- **FR-032a**: No critério "só desempenho pessoal", herói sem histórico do jogador MUST ser marcado
  como "sem dado" (FR-018) e MUST NOT ser substituído silenciosamente pelo número do meta.
- **FR-033**: O jogador MUST poder escolher o ranque de referência do meta.
- **FR-034**: O app MUST usar o winrate **geral** do herói para ordenar, sem recorte por
  posição/função, em todos os grupos.
- **FR-034a**: O app MUST NOT tentar inferir a posição de um grupo a partir do nome dele, e MUST NOT
  pedir ao jogador que mapeie grupos para posições. O mesmo herói presente em dois grupos recebe a
  mesma nota nos dois.
- **FR-034b**: A tela MUST deixar claro que o winrate exibido é o geral do herói, não o da função do
  grupo — para o jogador não ler a ordem de um grupo de suportes como "melhores suportes".

**Visibilidade**

- **FR-035**: O app MUST oferecer uma tela onde o jogador vê o ranking resultante — herói, winrate,
  fonte, amostra, parcelas da nota combinada e posição no espelho — antes e depois de sincronizar.
- **FR-035a**: Herói que está no ranking mas não pertence a nenhum grupo do layout de origem MUST
  aparecer nessa tela marcado como "fora do layout de origem", sem ser inserido no espelho (FR-008a).
- **FR-035b**: A tela MUST deixar claro qual layout é a origem e qual é o espelho, e MUST informar
  quando o espelho está desatualizado em relação à estrutura de origem.
- **FR-036**: O app MUST registrar um histórico das sincronizações recentes (quando, resultado,
  fontes usadas) consultável pelo jogador.
- **FR-037**: O app MUST limitar o acúmulo de cópias de segurança, mantendo as mais recentes.

### Key Entities

- **Preferência de ordenação de loadout**: estado da feature (ativa/inativa, padrão inativa), conta
  Steam alvo, local da coleção de layouts, layout de origem escolhido, nome do layout espelho,
  critério de ordenação (padrão combinado) e ranque de referência.
- **Coleção de layouts de heróis**: o conjunto de layouts da conta Steam. Contém os layouts do jogador
  e, quando a feature está ativa, o espelho. É o alvo do backup e da escrita tudo-ou-nada.
- **Layout de origem**: um layout do jogador — grupos nomeados, cada um com uma lista ordenada de
  heróis. É propriedade dele e a feature apenas **lê**.
- **Layout espelho**: layout gerado pelo app. Copia grupos, nomes, posições e alocação de heróis do
  layout de origem, com a ordem interna vinda do ranking. É propriedade do app: recriado a cada
  sincronização, edições manuais nele não sobrevivem.
- **Winrate de herói**: para um herói, um valor de vitória, o tamanho da amostra, a fonte de origem, o
  ranque a que se refere e o patch. **Não** há recorte por posição.
- **Desempenho pessoal por herói**: derivado do histórico do perfil já configurado no app — taxa de
  vitória do jogador com aquele herói e quantidade de partidas que sustenta o número. Ausente é um
  estado válido e distinto de zero.
- **Nota combinada**: para um herói, a parcela vinda do meta, a parcela vinda do desempenho pessoal,
  o peso aplicado a cada uma e a nota final. Sem as parcelas, a nota não é exibível (FR-030b).
- **Ranking de heróis**: resultado do critério aplicado aos winrates — a ordem que será escrita no
  espelho, com a procedência de cada linha preservada e a marcação de heróis que estão fora do layout
  de origem.
- **Registro de sincronização**: momento, resultado (sucesso/parcial/falha), fontes consultadas,
  fontes que falharam, quantidade de heróis ordenados e se a estrutura de origem mudou desde a última.
- **Cópia de segurança da coleção**: snapshot da coleção de layouts anterior a uma escrita, com o
  momento em que foi tirado, restaurável.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em instalação nova, 100% dos usuários encontram a feature desmarcada e nenhuma
  requisição às fontes de meta ou leitura da coleção de layouts ocorre antes de eles marcarem a opção.
- **SC-002**: O jogador consegue ativar a feature, escolher o layout de origem e ver o espelho
  ordenado em menos de 2 minutos a partir de abrir as configurações, sem consultar documentação.
- **SC-003**: Em 100% das sincronizações bem-sucedidas, o layout de origem permanece **igual em
  profundidade** ao que era antes — mesmos grupos, nomes, coordenadas e ordem de heróis — e nenhum
  outro layout da coleção é alterado. Divergência detectada antes de gravar aborta a escrita em 100%
  dos casos.
- **SC-003a**: Em 100% das sincronizações bem-sucedidas, o espelho tem os mesmos grupos, os mesmos
  nomes e o mesmo conjunto de heróis por grupo do layout de origem — a diferença é exclusivamente de
  ordem.
- **SC-003b**: Após 30 sincronizações consecutivas, a coleção contém exatamente um layout espelho por
  layout de origem configurado — inclusive quando o jogador renomeou o espelho ou a origem no meio do
  caminho.
- **SC-003c**: A feature produz o mesmo resultado correto para uma coleção com 1 layout e para uma com
  vários, e para layouts com 1 grupo, com 20 grupos, com grupos vazios e com grupos de nome repetido.
- **SC-004**: Em 100% das sincronizações, existe uma cópia de segurança restaurável da coleção
  imediatamente anterior, e a restauração devolve o arquivo **byte a byte** — conferível por hash.
- **SC-005**: 100% dos winrates apresentados na tela exibem fonte e tamanho de amostra; nenhum número
  aparece sem procedência.
- **SC-005a**: 100% das notas combinadas exibidas permitem ver as duas parcelas que as formaram e o
  peso de cada uma.
- **SC-005b**: Com apenas uma das duas fontes disponível, 100% das sincronizações ainda concluem, e
  a tela informa qual fonte faltou.
- **SC-006**: Quando todas as fontes falham, 0% das execuções alteram a coleção de layouts.
- **SC-007**: Com a feature ativa, ocorre no máximo uma sincronização automática por período de 24h
  — nunca duas — verificado ao longo de 7 dias de uso. Dias com o app fechado não sincronizam, e a
  primeira abertura seguinte sincroniza uma vez, não uma vez por dia perdido.
- **SC-008**: A interface do app permanece responsiva durante a sincronização, sem travamento
  perceptível.
- **SC-009**: Uma sincronização completa (buscar dados das fontes e escrever o espelho) conclui em
  menos de 30 segundos em conexão doméstica típica.
- **SC-010**: Zero relatos de layout de origem corrompido, alterado ou perdido entre os usuários da
  feature.
- **SC-011**: O jogador identifica em uma olhada, na tela da feature, quando foi a última
  sincronização e se ela deu certo.

## Assumptions

- **Escopo de escrita**: a feature escreve na coleção de layouts de heróis que o próprio Dota 2 lê, na
  conta Steam local escolhida pelo jogador, e o que ela escreve é **um layout novo**. Não altera nada
  dentro dos servidores da Valve, nem perfil, nem inventário/cosméticos — "loadout" aqui significa a
  organização da tela de escolha de heróis.
- **Estratégia de espelho** (decidido, revisão de 2026-08-26): em vez de reordenar o layout do jogador
  no lugar, a feature gera um layout **espelho** — cópia fiel em grupos, nomes e alocação, com a ordem
  interna vinda do ranking — e mantém o layout de origem intocado. O jogador alterna entre os dois no
  jogo. Um espelho por layout de origem, atualizado a cada sincronização, nunca duplicado.
- **Por que espelho e não reordenação no lugar**: o layout de origem é trabalho manual que não existe
  em nenhum outro lugar. Espelhar remove a classe inteira de falha "a feature estragou meu grid",
  torna o desfazer trivial (apagar o espelho) e deixa o jogador comparar as duas ordens lado a lado.
  O preço é um layout a mais na coleção e a necessidade de re-espelhar quando a origem muda.
- **Agnóstico a organização** (verificado na revisão de 2026-08-26): a ordenação não interpreta o
  significado de nenhum grupo — copia a categoria e reordena a lista. Qualquer quantidade de grupos,
  qualquer nome, qualquer coordenada. A decisão de ignorar posição (Q3) é o que garante isso: uma
  heurística de nome funcionaria bem para grupos chamados "Carry"/"Mid" e mal para todo o resto.
- **Heróis fora da origem**: espelho é espelho — a feature não insere herói que não esteja no layout de
  origem. Heróis fortes que ficaram de fora aparecem na tela de ranking marcados como tal, para o
  jogador acrescentar à mão se quiser.
- **Fontes**: OpenDota (pública, sem token, cobertura ampla, já integrada no app) na frente, STRATZ
  (exige o token pessoal) atrás. São as duas únicas, ambas usadas por ranque e sem recorte de posição.
  A inversão da precedência foi esclarecida em 2026-08-26: com o recorte por posição removido, as duas
  entregam a mesma coisa, e o desempate passou a ser "qual funciona sem configuração".
- **Sem recorte por posição** (esclarecido em 2026-08-26). Os nomes de grupo do jogador são livres,
  em pt-BR e abreviados (`Hcs Principais`, `Supps secundários`), e carregam um eixo que não é posição
  (principal/secundário). Heurística de nome erraria em silêncio — ordenaria um grupo de suportes pela
  estatística de carry, produzindo uma lista plausível e errada. Mapeamento manual foi descartado por
  fricção. Consequência aceita: a ordem dentro de um grupo reflete a força geral do herói no patch,
  não a força dele naquela função, e a tela precisa dizer isso (FR-034b).
- **Dota 2 Pro Tracker cortado do escopo** (esclarecimento de 2026-08-26). Ele estava no pedido
  original, mas o que ele publica de forma consumível é a **ordem** dos heróis no meta, sem winrate e
  sem tamanho de amostra. Usá-lo obrigaria a abrir exceção na regra de procedência do projeto ou a
  parsear payload de hidratação de framework. A escolha foi perder o recorte de alto MMR e manter a
  regra sem exceção. Consequência aceita: o "meta" da feature é o que a STRATZ consegue segmentar por
  ranque, não o meta de 7000+ MMR e pro.
- **Critério padrão é o combinado** (decidido): meta do patch como base, ajustado pelo histórico do
  jogador, com o peso do componente pessoal crescendo com o tamanho da amostra dele. Sem histórico
  utilizável, recai para o meta geral e diz isso. A decomposição da nota (parcela do meta, parcela
  pessoal, pesos) precisa estar disponível — é o que impede a nota combinada de virar número opaco.
- **Credencial**: a STRATZ exige o token pessoal que o jogador já configurou no app. Sem token, a
  feature opera inteira só com a OpenDota e diz isso — nenhuma parte dela fica indisponível por falta
  de credencial.
- **Cadência** (esclarecido em 2026-08-26): "1 vez por dia" é intervalo de 24h a partir da última
  sincronização bem-sucedida, não horário fixo do dia. Dados de meta não mudam de hora em hora.
- **"Processo em background" é dentro do app** (esclarecido em 2026-08-26). A sincronização roda em
  segundo plano na sessão do app — sem travar a interface e sem o jogador pedir — mas não sobrevive ao
  app fechado. Diferença deliberada em relação ao MetaGrid, que instala inicialização automática.
  Consequência aceita: quem não abre o GlimpseGG por uma semana pega o espelho de uma semana atrás, e
  a tela diz isso (FR-024a).
- **Plataformas**: a detecção da coleção de layouts precisa funcionar nos três sistemas que o app já publica
  (Linux, Windows, macOS). Instalações fora do padrão são atendidas pela indicação manual do caminho
  (FR-006).
- **Modo navegador** (execução sem o empacotamento desktop, usado em desenvolvimento) não tem acesso
  ao sistema de arquivos do jogador; nesse modo a feature exibe o ranking mas não escreve layout
  nenhum, e diz isso claramente.
- **Sem dado fabricado**: a feature herda a doutrina do projeto — quando falta dado, a saída legítima
  é esconder ou rotular como estimativa, nunca preencher a lacuna.
- **Privacidade**: os dados envolvidos são de conta de jogo e estatística pública de heróis; nenhum
  dado de terceiro é coletado e nada é enviado a serviço próprio (o app não tem backend).
- **Fora de escopo nesta feature**: sugerir picks durante a partida em andamento, ler o estado da
  tela de draft ao vivo, editar cosméticos/inventário, alterar o layout de origem, criar layouts de
  meta do zero (por função, à moda do MetaGrid) para quem não tem layout nenhum, espelhar vários
  layouts de origem ao mesmo tempo, inserir ou remover heróis em relação à origem, consultar o
  Dota 2 Pro Tracker, e qualquer forma de execução sem o app aberto (autostart, bandeja, serviço,
  modo headless).

## Riscos

- **R-001**: Sem o Dota 2 Pro Tracker, o recorte de meta da feature é o que a STRATZ segmenta por
  ranque — não o meta de alto MMR que o pedido original mencionava. Para quem joga em Divine/Immortal
  a diferença é pequena; para quem quer explicitamente "o que os pros estão jogando", a feature não
  responde essa pergunta. Mitigação: rotular o recorte com clareza (FR-014, FR-020) para não
  prometer o que não entrega. Reabrir a fonte exige uma que forneça winrate e amostra (FR-013b).
- **R-002**: A feature escreve no arquivo que guarda os layouts que o jogador construiu à mão; um erro
  aqui destrói trabalho que não está em nenhum outro lugar. A estratégia de espelho já elimina a
  reescrita do layout de origem (FR-007), mas o **arquivo** continua sendo compartilhado. Mitigação:
  backup obrigatório da coleção (FR-009), escrita tudo-ou-nada (FR-010), abortar sem escrever se a
  imutabilidade da origem não puder ser garantida (FR-007b), restauração em um comando (FR-004) e
  hash do backup conferível pelo jogador (SC-004).
- **R-002a**: O espelho pode envelhecer em silêncio se o jogador reorganizar a origem e a
  sincronização não perceber, deixando ele pickando de um grid que não corresponde mais ao dele.
  Mitigação: re-espelhar a estrutura a cada sincronização (FR-008d) e sinalizar espelho desatualizado
  na tela (FR-035b).
- **R-003**: O cliente do Dota 2 reescreve esse arquivo ao sair e pode descartar a alteração,
  produzindo a impressão de que a feature não funciona. Mitigação: detecção de jogo em execução e
  aviso (FR-011).
- **R-004**: Consulta diária automática a fontes externas pode ser interpretada como uso abusivo.
  Mitigação: uma sincronização por dia (FR-022), espera crescente entre falhas (FR-028), zero
  requisição com a feature desligada (FR-002).
- **R-005**: A nota combinada é mais difícil de justificar do que um winrate cru — se o jogador não
  entender por que um herói subiu, a feature perde credibilidade. Mitigação: decomposição da nota
  sempre disponível (FR-030b), amostra pessoal visível por herói (FR-032) e possibilidade de voltar
  ao meta puro em um clique (FR-031).
