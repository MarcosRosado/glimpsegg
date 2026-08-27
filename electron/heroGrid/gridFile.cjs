// Leitura e escrita do `hero_grid_config.json` do jogador.
//
// Este é o único módulo do app que escreve num arquivo que **não é nosso**: o formato é da
// Valve, o arquivo pertence ao jogador e o cliente do Dota 2 também escreve nele. Todo
// mecanismo aqui (backup byte a byte, tmp+fsync+rename, guarda de igualdade profunda, trava de
// escrita única) existe porque um bug neste arquivo destrói trabalho manual que o jogador não
// tem de onde recuperar. Referências `L-n`/`E-n` são as regras de
// `specs/001-meta-hero-grid/contracts/hero-grid-file.md`; `I-n` são as invariantes de
// `specs/001-meta-hero-grid/data-model.md`.
//
// PRINCÍPIO DE FRONTEIRA (contracts/ipc-hero-grid.md): o main process não decide nada. Ele não
// sabe o que é winrate, espelho ou ranking, e NÃO SERIALIZA NADA — o texto a gravar chega pronto
// em `request.content`, produzido por `src/utils/heroGrid/valveJson.ts`, que é função pura e
// testável pelo vitest. A única decisão que mora aqui é "estes bytes podem ir para o disco?",
// e ela mora aqui de propósito: é a última linha antes do disco, e precisa validar exatamente
// os bytes que serão gravados, não um objeto que alguém prometeu ter serializado direito.
//
// PRÉ-REQUISITO DE QUEM CHAMA (S-1): a validação do `path` recebido do renderer — terminar em
// `hero_grid_config.json` e estar sob um `userdata/<id3>/570/remote/cfg/` de raiz Steam
// reconhecida, ou ser exatamente o caminho manual configurado pelo jogador — é feita no
// `electron/main.cjs`, antes de chamar qualquer função deste módulo. Este módulo NÃO revalida
// caminho: chamá-lo com caminho arbitrário grava em caminho arbitrário.
//
// S-2: nenhuma mensagem de erro daqui inclui token nem conteúdo de config. As mensagens citam
// código, índice e caminho — nunca nome de layout, nome de categoria ou lista de heróis.

const fs = require('fs');
const path = require('path');

/** Sufixo do arquivo temporário da escrita atômica (E-2). */
const TMP_SUFFIX = '.glimpse.tmp';

/** Infixo dos backups: `hero_grid_config.glimpse.bak.<epoch>` (E-1). */
const BACKUP_INFIX = '.glimpse.bak.';

/** E-6: no máximo 5 backups; os mais antigos são apagados depois de cada escrita. */
const MAX_BACKUPS = 5;

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

/**
 * Traduz erro de I/O para o `HeroGridErrorCode` correspondente.
 *
 * Devolve `null` quando não há código honesto na união fechada de `types/heroGrid.ts` — nesse
 * caso o chamador reporta só a mensagem. Inventar `NO_PERMISSION` para um EIO seria mandar o
 * jogador ajustar permissão de um disco com defeito.
 */
function ioErrorCode(err) {
  const code = err && err.code;
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return 'NO_PERMISSION';
  if (code === 'ENOENT' || code === 'ENOTDIR') return 'FILE_NOT_FOUND';
  return null;
}

/** `true` quando o erro de I/O significa "não existe" — inclui componente de caminho ausente. */
function isMissing(err) {
  const code = err && err.code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}

/**
 * Faz o parse do texto do arquivo aplicando L-2 e L-3.
 *
 * Não valida mais do que isso de propósito: L-4 manda PRESERVAR campo desconhecido que a Valve
 * acrescente em patch novo, então um "schema" estrito aqui viraria perda de dado do jogador na
 * escrita seguinte. `configs` ser um array é o mínimo sem o qual nada da feature faz sentido.
 *
 * @param {string} raw
 * @returns {{ file: object|null, code?: string, error?: string }}
 */
function parseGridText(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // L-2: JSON inválido aborta e informa. Nunca sobrescreve — pode ser arquivo do jogador que
    // um editor deixou pela metade, e reescrever apagaria o que sobrou.
    return { file: null, code: 'INVALID_JSON', error: `JSON invalido: ${err && err.message ? err.message : 'erro de parse'}` };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { file: null, code: 'INVALID_JSON', error: 'JSON invalido: raiz nao e um objeto' };
  }

  // L-3: `configs` ausente ou não-array é arquivo inválido, tratado igual a L-2.
  if (!Array.isArray(parsed.configs)) {
    return { file: null, code: 'INVALID_JSON', error: 'JSON invalido: "configs" ausente ou nao e um array' };
  }

  return { file: parsed };
}

/**
 * Lê o arquivo de grids.
 *
 * @param {string} filePath caminho JÁ VALIDADO por S-1 no `main.cjs`.
 * @param {object} [fsImpl] injeção para teste; qualquer objeto com a API síncrona do `fs`.
 * @returns {{ exists: boolean, file: object|null, raw?: string, code?: string, error?: string }}
 *   `raw` volta junto porque o backup de E-1 é byte a byte e precisa do texto original, não de
 *   um `JSON.stringify` do objeto — reserializar já perderia a formatação da Valve.
 */
function readGridFile(filePath, fsImpl = fs) {
  let raw;
  try {
    raw = fsImpl.readFileSync(filePath, 'utf-8');
  } catch (err) {
    if (isMissing(err)) {
      // L-1: arquivo ausente NÃO é erro e NÃO é criado aqui. O `hero_grid_config.json` só nasce
      // quando o jogador cria o primeiro grid dentro do Dota; criá-lo nós seria escrever no
      // arquivo do jogador antes de ele ter pedido qualquer coisa.
      return { exists: false, file: null };
    }
    const code = ioErrorCode(err);
    const result = { exists: true, file: null, error: err && err.message ? err.message : String(err) };
    if (code) result.code = code;
    return result;
  }

  const parsed = parseGridText(raw);
  if (parsed.code) {
    // `raw` vai junto mesmo no caminho inválido: quem chamou pode querer mostrar o tamanho ou
    // guardar uma cópia antes de qualquer intervenção manual. Inválido nunca virá escrita.
    return { exists: true, file: null, raw, code: parsed.code, error: parsed.error };
  }

  return { exists: true, file: parsed.file, raw };
}

/* ------------------------------------------------------------------ *
 * Igualdade profunda (a guarda de E-3/E-4)
 * ------------------------------------------------------------------ */

/**
 * Igualdade profunda escrita à mão, sem dependência nova.
 *
 * POR QUE NÃO `JSON.stringify(a) === JSON.stringify(b)`: a ordem das chaves entra no texto, e o
 * `mirrorBuilder` copia config por spread — basta uma chave desconhecida da Valve mudar de
 * posição para o `stringify` divergir e a guarda acusar mutação que não houve. Falso positivo
 * aqui não é "erro de lado seguro": ele desliga a feature inteira sem sintoma que aponte a causa.
 *
 * Array vs objeto é comparado explicitamente porque `{}` e `[]` são coisas diferentes num campo
 * desconhecido da Valve e `typeof` não distingue os dois.
 */
function deepEqual(a, b) {
  if (a === b) return true;

  if (typeof a !== typeof b) return false;
  // Depois do `a === b` acima, `null` só chega aqui contra um objeto — nunca contra `null`.
  if (a === null || b === null) return false;
  // Primitivo diferente: já falhou no `===`. (JSON não produz NaN, então não há caso a tratar.)
  if (typeof a !== 'object') return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * Backups
 * ------------------------------------------------------------------ */

/**
 * Nomes derivados do caminho do arquivo, todos no MESMO diretório dele.
 *
 * Mesmo diretório não é detalhe: `rename` só é atômico dentro do mesmo filesystem, e o
 * `os.tmpdir()` frequentemente é outro (tmpfs). Um tmp em `/tmp` transformaria a troca atômica
 * numa cópia, que pode ser interrompida no meio e deixar o arquivo do jogador truncado.
 */
function pathsFor(filePath) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const stem = base.endsWith('.json') ? base.slice(0, -'.json'.length) : base;
  return {
    dir,
    base,
    /** `hero_grid_config.json.glimpse.tmp` (E-2). */
    tmpPath: path.join(dir, `${base}${TMP_SUFFIX}`),
    /** Prefixo de `hero_grid_config.glimpse.bak.<epoch>` (E-1). */
    backupPrefix: `${stem}${BACKUP_INFIX}`,
  };
}

/**
 * Lista os backups do arquivo, do mais novo para o mais velho.
 *
 * A ordem vem do `<epoch>` do NOME, não do `mtime`: `mtime` muda com cópia, `rsync`, restauração
 * e backup de sistema, e a poda de E-6 apagando o backup errado é perda de dado silenciosa.
 *
 * @returns {Array<{ path: string, at: number, bytes: number }>}
 */
function listGridBackups(filePath, fsImpl = fs) {
  const { dir, backupPrefix } = pathsFor(filePath);

  let names;
  try {
    names = fsImpl.readdirSync(dir);
  } catch {
    // Diretório inacessível não é "sem backup" com certeza, mas é o que podemos afirmar: lista
    // vazia. Quem chama já vai falhar no I/O real com o código certo.
    return [];
  }

  const entries = [];
  for (const name of names) {
    if (!String(name).startsWith(backupPrefix)) continue;
    const stamp = String(name).slice(backupPrefix.length);
    // Só sufixo numérico: qualquer outra coisa no diretório não é backup nosso e não é apagada.
    if (!/^\d+$/.test(stamp)) continue;

    const fullPath = path.join(dir, String(name));
    let bytes = 0;
    try {
      bytes = fsImpl.statSync(fullPath).size;
    } catch {
      continue;
    }
    entries.push({ path: fullPath, at: Number(stamp), bytes });
  }

  entries.sort((a, b) => (b.at - a.at) || a.path.localeCompare(b.path));
  return entries;
}

/**
 * Caminho de backup livre para este instante.
 *
 * O `while` existe porque duas escritas no mesmo milissegundo produziriam o mesmo nome, e a
 * segunda sobrescreveria o backup da primeira — perdendo justamente o estado mais antigo, que é
 * o que o jogador quer de volta.
 */
function freeBackupPath(fsImpl, filePath, startedAt) {
  const { dir, backupPrefix } = pathsFor(filePath);
  let stamp = Number.isFinite(startedAt) ? Math.floor(startedAt) : Date.now();
  let candidate = path.join(dir, `${backupPrefix}${stamp}`);
  while (fsImpl.existsSync(candidate)) {
    stamp += 1;
    candidate = path.join(dir, `${backupPrefix}${stamp}`);
  }
  return candidate;
}

/** E-6: mantém os `MAX_BACKUPS` mais recentes e apaga o resto. */
function pruneBackups(fsImpl, filePath) {
  const entries = listGridBackups(filePath, fsImpl);
  for (const entry of entries.slice(MAX_BACKUPS)) {
    try {
      fsImpl.unlinkSync(entry.path);
    } catch (err) {
      // Poda é higiene, não correção: falhar aqui não pode transformar uma escrita bem-sucedida
      // em erro para o jogador — o layout já está no disco.
      console.warn('[heroGrid] Nao foi possivel apagar backup antigo:', err && err.message ? err.message : err);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Escrita atômica
 * ------------------------------------------------------------------ */

function fail(code, message) {
  const result = { success: false, error: message };
  if (code) result.code = code;
  return result;
}

/** Remove o tmp em qualquer caminho de saída, inclusive nos aborts (E-2). */
function removeTmp(fsImpl, tmpPath) {
  try {
    fsImpl.unlinkSync(tmpPath);
  } catch (err) {
    if (!isMissing(err)) {
      console.warn('[heroGrid] Nao foi possivel remover o arquivo temporario:', err && err.message ? err.message : err);
    }
  }
}

/** Limpeza de saída: nunca deixa exceção escapar de um bloco `finally`. */
function cleanupTmp(fsImpl, tmpPath) {
  try {
    if (fsImpl.existsSync(tmpPath)) removeTmp(fsImpl, tmpPath);
  } catch (err) {
    console.warn('[heroGrid] Falha ao limpar o arquivo temporario:', err && err.message ? err.message : err);
  }
}

/**
 * Substitui o conteúdo de `filePath` por `data`, atomicamente (E-2).
 *
 * tmp → `fsync` → `rename`, nesta ordem, e a ordem é o ponto:
 *
 * - `rename` no mesmo filesystem é atômico: quem abrir o arquivo vê o conteúdo antigo INTEIRO ou
 *   o novo INTEIRO, nunca metade. Gravar direto sobre o original não tem essa propriedade — uma
 *   queda de energia no meio do `write` deixa o grid do jogador truncado.
 * - O `fsync` ANTES do `rename` é o que falta na versão "óbvia" desse truque. `rename` só
 *   publica o nome; o CONTEÚDO do tmp pode estar apenas no cache de página. Se a máquina cair
 *   entre o rename e o flush, o metadado (o nome apontando para o inode novo) sobrevive e os
 *   dados não: o jogador reabre o Dota e encontra um `hero_grid_config.json` de tamanho certo
 *   cheio de zeros. Sincronizar antes de publicar o nome torna esse estado impossível.
 *
 * @returns {{ error?: { code: string|null, message: string } }}
 */
function atomicReplace(fsImpl, filePath, data) {
  const { tmpPath } = pathsFor(filePath);
  try {
    const fd = fsImpl.openSync(tmpPath, 'w');
    try {
      fsImpl.writeFileSync(fd, data);
      fsImpl.fsyncSync(fd);
    } finally {
      fsImpl.closeSync(fd);
    }
    fsImpl.renameSync(tmpPath, filePath);

    // Melhor esforço: sincronizar o DIRETÓRIO faz a própria entrada de nome sobreviver a uma
    // queda. Não é suportado em toda plataforma (o Windows recusa abrir diretório), e falhar
    // aqui não desfaz nada — o rename já aconteceu — então o erro é ignorado de propósito.
    try {
      const dirFd = fsImpl.openSync(path.dirname(filePath), 'r');
      try {
        fsImpl.fsyncSync(dirFd);
      } finally {
        fsImpl.closeSync(dirFd);
      }
    } catch {
      /* plataforma que não permite fsync de diretório */
    }

    return {};
  } catch (err) {
    removeTmp(fsImpl, tmpPath);
    return {
      error: {
        code: ioErrorCode(err),
        message: err && err.message ? err.message : String(err),
      },
    };
  }
}

/* ------------------------------------------------------------------ *
 * A guarda (E-3, E-4, I-1, I-2, I-3)
 * ------------------------------------------------------------------ */

/**
 * Decide se os bytes de `next` podem substituir `current`.
 *
 * É a função mais importante do módulo, e é pura de propósito: nada de I/O aqui, para que a
 * decisão seja verificável isoladamente. A regra em uma frase: **a única posição de `configs`
 * que pode diferir do que está em disco é `expectedMirrorIndex`.** Todo o resto — origem,
 * layouts do jogador, `version` — tem de bater em profundidade.
 *
 * @param {object} current arquivo LIDO do disco agora.
 * @param {object} next arquivo parseado dos bytes que serão gravados.
 * @param {object} request o `GridWriteRequest`.
 * @returns {{ code: string, error: string }|null} `null` quando pode gravar.
 */
function evaluateWriteGuards(current, next, request) {
  const mirrorIndex = request.expectedMirrorIndex;
  const sourceIndex = request.expectedSourceIndex;

  // 1. Tamanho do array no conteúdo a gravar.
  if (next.configs.length !== request.expectedConfigCount) {
    return {
      code: 'CONFIG_COUNT_MISMATCH',
      error: `O conteudo tem ${next.configs.length} layouts, e ${request.expectedConfigCount} eram esperados.`,
    };
  }

  // 1b. A posição do espelho tem de existir NO CONTEÚDO. Sem esta checagem, um índice fora da
  //     faixa (bug de quem chama) faria a comparação do passo 6 varrer todos os configs, achar
  //     tudo igual e gravar — uma escrita que não muda nada mas consome backup e reformata o
  //     arquivo do jogador sem motivo.
  if (!Number.isInteger(mirrorIndex) || mirrorIndex < 0 || mirrorIndex >= next.configs.length) {
    return {
      code: 'CONFIG_COUNT_MISMATCH',
      error: `A posicao ${mirrorIndex} do espelho nao existe no conteudo a gravar.`,
    };
  }

  // 2. Tamanho do array em DISCO. Espelho novo nasce no fim (N-6), então o disco tem um a menos;
  //    em qualquer outro caso tem de ter exatamente a contagem esperada. Divergir aqui significa
  //    que o Dota criou ou apagou um layout depois da leitura do renderer — os índices guardados
  //    não valem mais e gravar apontaria para o layout errado.
  const isNewMirror = mirrorIndex === current.configs.length;
  const expectedOnDisk = isNewMirror ? request.expectedConfigCount - 1 : request.expectedConfigCount;
  if (current.configs.length !== expectedOnDisk) {
    return {
      code: 'CONFIG_COUNT_MISMATCH',
      error: `O arquivo em disco tem ${current.configs.length} layouts, e ${expectedOnDisk} eram esperados; ele mudou desde a leitura.`,
    };
  }

  // 3. I-3: `version` é preservado, nunca reescrito — alterá-la é o que o contrato proíbe
  //    explicitamente, e o app não tem informação nenhuma para decidir versão de formato.
  if (!deepEqual(next.version, current.version)) {
    return {
      code: 'SOURCE_MUTATED',
      error: 'O conteudo altera "version" do arquivo, que tem de ser preservado.',
    };
  }

  // 4. N-4: a posição registrada da origem tem de existir nos dois lados. Não adivinhar por nome.
  if (
    !Number.isInteger(sourceIndex)
    || sourceIndex < 0
    || sourceIndex >= current.configs.length
    || sourceIndex >= next.configs.length
  ) {
    return {
      code: 'SOURCE_INDEX_GONE',
      error: `A posicao ${sourceIndex} do layout de origem nao existe mais no arquivo.`,
    };
  }

  // 5. E-3/I-1: a origem nos bytes a gravar tem de ser igual em profundidade à que o renderer
  //    leu. É a assertiva central da feature: o layout do jogador não é tocado.
  if (!deepEqual(next.configs[sourceIndex], request.expectedSourceConfig)) {
    return {
      code: 'SOURCE_MUTATED',
      error: `O layout de origem na posicao ${sourceIndex} difere do esperado; nada foi gravado.`,
    };
  }

  // 6. E-4/I-2: todo config que NÃO é o espelho tem de ser byte-idêntico em estrutura ao que
  //    está em disco AGORA — inclusive a origem (o passo 5 compara com o esperado, este compara
  //    com o disco, e os dois casos são reais: o renderer pode estar velho, ou o serializador
  //    pode ter perdido um campo desconhecido da Valve).
  for (let i = 0; i < next.configs.length; i += 1) {
    if (i === mirrorIndex) continue;
    if (i >= current.configs.length) {
      return {
        code: 'SOURCE_MUTATED',
        error: `O conteudo acrescenta um layout na posicao ${i}, que nao e a do espelho.`,
      };
    }
    if (!deepEqual(next.configs[i], current.configs[i])) {
      return {
        code: 'SOURCE_MUTATED',
        error: `O layout na posicao ${i} difere do que esta em disco; nada foi gravado.`,
      };
    }
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Trava de escrita única (E-5)
 * ------------------------------------------------------------------ */

/**
 * E-5: uma escrita por vez, no nível do módulo.
 *
 * Bandeira simples basta porque isto roda no processo main, que é single-threaded: a única forma
 * de interleaving é o `await` do detector de Dota, e é exatamente essa janela que a trava fecha.
 * Sem ela, duas sincronizações disparadas juntas (o botão manual e o agendador, por exemplo)
 * fariam backup uma da outra e a segunda gravaria sobre a primeira.
 */
let writeInProgress = false;

/** O detector de verdade, resolvido tarde para não acoplar a ordem de carga dos módulos. */
function defaultDotaDetector() {
  try {
    return require('./dotaProcess.cjs').isDotaRunning;
  } catch (err) {
    console.warn('[heroGrid] Detector de processo indisponivel:', err && err.message ? err.message : err);
    return null;
  }
}

/**
 * Grava o arquivo de grids.
 *
 * O `request.content` chega PRONTO do renderer (`valveJson.ts`) — este módulo não serializa nada
 * (princípio de fronteira). Aqui só se decide se esses bytes podem ir para o disco.
 *
 * @param {object} request `GridWriteRequest` de `src/types/heroGrid.ts`. `path` já validado por
 *   S-1 no `main.cjs`.
 * @param {{ fsImpl?: object, isDotaRunningImpl?: Function, now?: Function }} [deps] injeção para
 *   teste — nenhum teste deste módulo executa `ps` nem toca no Steam real.
 * @returns {Promise<{ success: true, data: { backupPath: string, bytesWritten: number } }
 *   | { success: false, error: string, code?: string }>} nunca lança: o handler IPC devolve isto
 *   direto para o renderer.
 */
async function writeGridFile(request, deps = {}) {
  const fsImpl = deps.fsImpl || fs;
  const nowImpl = typeof deps.now === 'function' ? deps.now : Date.now;

  if (writeInProgress) {
    return fail('WRITE_IN_PROGRESS', 'Ja existe uma escrita do arquivo de grids em curso.');
  }
  writeInProgress = true;

  const { tmpPath } = pathsFor(request.path);

  try {
    // 1. E-7: Dota aberto sem confirmação explícita do jogador não grava. Com a confirmação,
    //    nem consultamos a lista de processos — a resposta já não mudaria a decisão.
    if (request.allowWhileDotaRunning === false) {
      const detect = deps.isDotaRunningImpl || defaultDotaDetector();
      let running = false;
      if (detect) {
        try {
          const status = await detect();
          running = Boolean(status && status.running);
        } catch (err) {
          // Mesma degradação de `dotaProcess.cjs`: falha de consulta não vira feature morta.
          console.warn('[heroGrid] Falha ao checar se o Dota esta aberto:', err && err.message ? err.message : err);
        }
      }
      if (running) {
        return fail('DOTA_RUNNING', 'O Dota 2 esta aberto; a escrita precisa de confirmacao explicita.');
      }
    }

    // 2. Relê o arquivo AGORA, em bytes. Os bytes servem dois papéis: o backup byte a byte de
    //    E-1 e a base da guarda. Reler é obrigatório — o estado que o renderer viu pode ter
    //    envelhecido, e é justamente contra isso que a guarda existe.
    let currentBytes;
    try {
      currentBytes = fsImpl.readFileSync(request.path);
    } catch (err) {
      if (isMissing(err)) {
        // L-1: o arquivo NÃO é criado aqui. Ele nasce quando o jogador cria um grid no Dota.
        return fail('FILE_NOT_FOUND', 'O arquivo de grids nao existe e nao e criado pelo app.');
      }
      return fail(ioErrorCode(err), err && err.message ? err.message : String(err));
    }

    const currentParsed = parseGridText(currentBytes.toString('utf-8'));
    if (currentParsed.code) {
      // L-2: arquivo em disco inválido nunca é sobrescrito — pode ser o único vestígio do que o
      // jogador tinha, e reescrever apagaria a chance de ele consertar à mão.
      return fail(currentParsed.code, currentParsed.error);
    }

    // 3. Parse do texto a gravar, antes de tocar em qualquer coisa no disco.
    const nextParsed = parseGridText(String(request.content));
    if (nextParsed.code) {
      return fail(nextParsed.code, nextParsed.error);
    }

    // 4. A guarda. Nada foi escrito até aqui, então abortar é literalmente não fazer nada.
    const violation = evaluateWriteGuards(currentParsed.file, nextParsed.file, request);
    if (violation) {
      return fail(violation.code, violation.error);
    }

    // 5. E-1: backup byte a byte. São os BYTES lidos, não um `JSON.stringify` do objeto —
    //    reserializar já perderia a formatação da Valve e qualquer detalhe que o parse não
    //    representa, e um backup que não reproduz o original não é backup.
    const backupPath = freeBackupPath(fsImpl, request.path, nowImpl());
    try {
      fsImpl.writeFileSync(backupPath, currentBytes);
    } catch (err) {
      // E-8: sem backup não há escrita. Falhar aqui deixa o original intacto, que é o objetivo.
      return fail(ioErrorCode(err), `Nao foi possivel criar o backup: ${err && err.message ? err.message : String(err)}`);
    }

    // 6. E-2: tmp + fsync + rename.
    const replaced = atomicReplace(fsImpl, request.path, request.content);
    if (replaced.error) {
      return fail(replaced.error.code, replaced.error.message);
    }

    // 7. E-6: poda depois do sucesso, com o backup novo já contando entre os 5.
    pruneBackups(fsImpl, request.path);

    return {
      success: true,
      data: {
        backupPath,
        bytesWritten: Buffer.byteLength(request.content, 'utf-8'),
      },
    };
  } finally {
    // E-2 em todo caminho de saída, inclusive nos aborts e numa exceção inesperada. Envolvido em
    // try/catch porque um erro aqui mascararia o resultado real da escrita, e a trava PRECISA
    // ser liberada — senão a primeira falha de limpeza mataria a feature até reiniciar o app.
    cleanupTmp(fsImpl, tmpPath);
    writeInProgress = false;
  }
}

/**
 * Restaura um backup sobre o arquivo de grids (SC-004).
 *
 * Síncrona de propósito: não há detector a consultar. Restaurar é decisão explícita do jogador,
 * feita quando ele já viu que algo saiu errado — não é o momento de perguntar se o Dota está
 * aberto e recusar.
 *
 * NÃO valida o JSON do backup, e isso é deliberado: o backup são os bytes que estavam no arquivo
 * DELE. Recusar a restauração por parse seria o app decidir que a cópia de segurança do jogador
 * não presta, justamente na hora em que ele quer o estado anterior de volta.
 *
 * @param {string} filePath caminho já validado por S-1.
 * @param {string} [backupPath] backup específico; ausente => o mais recente.
 * @param {{ fsImpl?: object }} [deps]
 */
function restoreGridFile(filePath, backupPath, deps = {}) {
  const fsImpl = deps.fsImpl || fs;

  if (writeInProgress) {
    return fail('WRITE_IN_PROGRESS', 'Ja existe uma escrita do arquivo de grids em curso.');
  }
  writeInProgress = true;

  const { tmpPath } = pathsFor(filePath);

  try {
    let chosen = backupPath;
    if (!chosen) {
      const entries = listGridBackups(filePath, fsImpl);
      if (entries.length === 0) {
        return fail('FILE_NOT_FOUND', 'Nao existe backup para restaurar.');
      }
      chosen = entries[0].path;
    }

    let bytes;
    try {
      bytes = fsImpl.readFileSync(chosen);
    } catch (err) {
      return fail(ioErrorCode(err), `Nao foi possivel ler o backup: ${err && err.message ? err.message : String(err)}`);
    }

    const replaced = atomicReplace(fsImpl, filePath, bytes);
    if (replaced.error) {
      return fail(replaced.error.code, replaced.error.message);
    }

    return { success: true, data: { restoredFrom: chosen } };
  } finally {
    cleanupTmp(fsImpl, tmpPath);
    writeInProgress = false;
  }
}

module.exports = {
  readGridFile,
  writeGridFile,
  restoreGridFile,
  listGridBackups,
  parseGridText,
  evaluateWriteGuards,
  deepEqual,
  TMP_SUFFIX,
  BACKUP_INFIX,
  MAX_BACKUPS,
};
