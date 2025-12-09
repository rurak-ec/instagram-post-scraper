import type { Page } from 'playwright';

/**
 * Genera un delay aleatorio entre min y max milisegundos
 */
export function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Espera un tiempo aleatorio similar a un humano
 */
export async function humanDelay(
  min: number = 1000,
  max: number = 3000,
): Promise<void> {
  const delay = randomDelay(min, max);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Simula movimiento de mouse humano (curvas suaves)
 */
export async function humanMouseMove(
  page: Page,
  x: number,
  y: number,
): Promise<void> {
  const currentPos = await page.evaluate(() => ({ x: 0, y: 0 }));

  // Dividir movimiento en pasos
  const steps = randomDelay(5, 15);
  const deltaX = (x - currentPos.x) / steps;
  const deltaY = (y - currentPos.y) / steps;

  for (let i = 0; i < steps; i++) {
    // Agregar variación natural
    const jitterX = (Math.random() - 0.5) * 2;
    const jitterY = (Math.random() - 0.5) * 2;

    await page.mouse.move(
      currentPos.x + deltaX * i + jitterX,
      currentPos.y + deltaY * i + jitterY,
    );

    await new Promise((resolve) => setTimeout(resolve, randomDelay(10, 30)));
  }

  // Movimiento final al destino exacto
  await page.mouse.move(x, y);
}

/**
 * Simula scroll humano (con variaciones naturales)
 */
export async function humanScroll(
  page: Page,
  distance: number = 300,
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) return;

  // Scroll en pequeños incrementos
  const steps = randomDelay(3, 8);
  const stepSize = distance / steps;

  for (let i = 0; i < steps; i++) {
    const variation = (Math.random() - 0.5) * 50;
    await page.mouse.wheel(0, stepSize + variation);
    await humanDelay(100, 300);
  }
}

/**
 * Movimientos aleatorios de mouse para parecer más humano
 */
export async function randomMouseMovements(
  page: Page,
  count: number = 2,
): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) return;

  for (let i = 0; i < count; i++) {
    const x = randomDelay(100, viewport.width - 100);
    const y = randomDelay(100, viewport.height - 100);

    await humanMouseMove(page, x, y);
    await humanDelay(500, 1500);
  }
}

/**
 * Delay entre visitas a diferentes perfiles
 */
export async function delayBetweenProfiles(): Promise<void> {
  // Entre 3 y 8 segundos entre perfiles
  await humanDelay(3000, 8000);
}

/**
 * Simula escritura humana con delays variables entre teclas
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string,
): Promise<void> {
  // Click en el campo primero
  await page.click(selector);

  // Pequeña pausa después del click (usuario posicionando manos)
  await humanDelay(200, 600);

  // Escribir caracter por caracter con delays variables
  for (const char of text) {
    await page.keyboard.type(char, {
      delay: randomDelay(80, 250), // Delay variable entre teclas
    });

    // Pausas ocasionales más largas (como si pensara o mirara el teclado)
    if (Math.random() < 0.15) {
      // 15% de probabilidad
      await humanDelay(300, 800);
    }
  }

  // Pausa final (usuario verificando lo que escribió)
  await humanDelay(300, 800);
}

/**
 * Pausa de "lectura de página" antes de interactuar
 */
export async function readPageBeforeAction(
  minMs: number = 1500,
  maxMs: number = 4000,
): Promise<void> {
  await humanDelay(minMs, maxMs);
}

/**
 * Movimiento de mouse a un elemento antes de hacer click
 */
export async function moveToElementAndClick(
  page: Page,
  selector: string,
): Promise<void> {
  // Obtener posición del elemento
  const box = await page.locator(selector).boundingBox();
  if (!box) {
    // Fallback: click directo si no se puede obtener la posición
    await page.click(selector);
    return;
  }

  // Calcular punto aleatorio dentro del elemento (no siempre en el centro)
  const x = box.x + box.width * (0.3 + Math.random() * 0.4); // Entre 30% y 70% del ancho
  const y = box.y + box.height * (0.3 + Math.random() * 0.4); // Entre 30% y 70% del alto

  // Mover mouse de forma humana
  await humanMouseMove(page, x, y);

  // Pausa antes de hacer click (usuario posicionando)
  await humanDelay(200, 600);

  // Click
  await page.click(selector);

  // Pausa después del click
  await humanDelay(150, 400);
}

/**
 * Simula que el usuario está "pensando" o decidiendo qué hacer
 */
export async function contemplationPause(
  minMs: number = 1000,
  maxMs: number = 3000,
): Promise<void> {
  await humanDelay(minMs, maxMs);
}

/**
 * Simula comportamiento de exploración de perfil
 */
export async function exploreProfile(page: Page): Promise<void> {
  const viewport = page.viewportSize();
  if (!viewport) return;

  // Observar página inicial
  await humanDelay(1500, 3000);

  // Movimientos de mouse exploratorios (2-4 movimientos)
  const movements = randomDelay(2, 4);
  for (let i = 0; i < movements; i++) {
    const x = randomDelay(100, viewport.width - 100);
    const y = randomDelay(100, viewport.height - 100);
    await humanMouseMove(page, x, y);
    await humanDelay(400, 1200);
  }

  // Scrolls exploratorios (1-4 scrolls)
  const scrolls = randomDelay(1, 4);
  for (let i = 0; i < scrolls; i++) {
    const distance = randomDelay(250, 550);
    await humanScroll(page, distance);
    await humanDelay(800, 2000);

    // Ocasionalmente scroll hacia arriba (como volviendo a ver algo)
    if (Math.random() < 0.25) {
      // 25% de probabilidad
      await humanScroll(page, -randomDelay(100, 300));
      await humanDelay(500, 1200);
    }
  }

  // Pausa final (leyendo información)
  await humanDelay(1000, 2500);
}
