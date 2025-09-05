import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const passengersFile = path.join(__dirname, "passengers.json");
const data = JSON.parse(fs.readFileSync(passengersFile, "utf-8"));

const config = data.trip;           
const passengers = data.passengers; 

function log(step) {
  console.log(`🟦 ${step}`);
}

async function firstVisibleLocator(page, candidates) {
  for (const c of candidates) {
    const loc = typeof c === "function" ? c(page) : page.locator(c);
    const count = await loc.count();
    for (let i = 0; i < count; i++) {
      const el = loc.nth(i);
      if (await el.isVisible().catch(() => false)) return el;
    }
  }
  return null;
}

async function selectCity(page, placeholder, cityName) {
  const input = page.locator(`input[placeholder='${placeholder}']`);
  await input.click();
  await input.fill(cityName);
  await page.waitForSelector("[role='option']");
  await page.locator("[role='option']").first().click();
  await page.waitForTimeout(800); 
}

async function selectDate(page, dateStr) {
  log(`Выбираем дату: ${dateStr}`);

  const dateInput = page.locator("#startDate");
  await dateInput.click();

  const calendar = page.locator("div.dp__calendar").first();
  await calendar.waitFor({ state: "visible", timeout: 10000 });

  const dayId = `dp-${dateStr}`;
  const dayLocator = page.locator(`#${dayId} .dp__cell_inner`);

  await dayLocator.waitFor({ state: "visible", timeout: 10000 });
  await dayLocator.click();

  log(`📅 Дата ${dateStr} выбрана`);
}

async function waitForTrains(page) {
  log("Ждем результатов поиска поездов…");
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const trains = await page.locator("section.TripUnitInfo").elementHandles();
    if (trains.length > 0) return trains;
    await page.waitForTimeout(500);
  }
  throw new Error("Не дождались списка поездов (проверь данные поиска).");
}

async function chooseTrainWithMostSeats(page) {
  log(`Выбираем поезд/вагон типа '${config.coachType}' (если есть)…`);

  await waitForTrains(page);

  const wagons = await page.locator(".TripUnitWagon[role='button']").elementHandles();
  if (wagons.length === 0) {
    throw new Error("Не нашли ни одной карточки вагона.");
  }

  let maxSeats = 0;
  let bestWagon = null;

  for (const wagon of wagons) {
    try {
      const typeText = await wagon.$eval("h4.Typography--h4", el => el.textContent.trim());
      const seatsText = await wagon.$eval(".Typography--caption", el => el.textContent);
      const seats = parseInt(seatsText?.match(/\d+/)?.[0] ?? "0", 10);

      if (new RegExp(config.coachType, "i").test(typeText)) {
        if (seats > maxSeats) {
          maxSeats = seats;
          bestWagon = wagon;
        }
      }
    } catch {
      continue;
    }
  }

  if (!bestWagon) {
    log(`⚠️ Не найдено '${config.coachType}', выбираем любой с максимальными местами…`);
    for (const wagon of wagons) {
      try {
        const seatsText = await wagon.$eval(".Typography--caption", el => el.textContent);
        const seats = parseInt(seatsText?.match(/\d+/)?.[0] ?? "0", 10);
        if (seats > maxSeats) {
          maxSeats = seats;
          bestWagon = wagon;
        }
      } catch {
        continue;
      }
    }
  }

  if (!bestWagon) {
    throw new Error("Не найдено доступных вагонов.");
  }

  await bestWagon.click();
  await page.waitForSelector("button.WagonUnitBed", { timeout: 10000 }); 
  await page.waitForTimeout(1000);
  log(`Кликнули по вагону (тип: ${config.coachType ?? "любой"}) с ${maxSeats} местами.`);
}

async function pickSeats(page, seatsToBook) {
  log("Ищем свободные места…");

  await page.waitForSelector("button.WagonUnitBed", { timeout: 15000 });
  await page.waitForTimeout(500);

  const freeSeats = page.locator("button.WagonUnitBed:not([disabled])");
  const count = await freeSeats.count();

  if (count === 0) {
    throw new Error("Свободных мест не найдено.");
  }

  let clicked = 0;
  for (let i = 0; i < count && clicked < seatsToBook; i++) {
    const btn = freeSeats.nth(i);
    const seatNumber = await btn.locator(".Typography--captionBold").innerText().catch(() => "?");

    try {
      await btn.click({ trial: true });
      await btn.click();
      log(`✅ Выбрали место №${seatNumber}`);
      clicked++;
      await page.waitForTimeout(500); 
    } catch (e) {
      log(`⚠️ Не удалось кликнуть по месту №${seatNumber}: ${e.message}`);
    }
  }

  if (clicked === 0) {
    throw new Error("Не удалось выбрать свободные места.");
  }

  const goToPassengers = await firstVisibleLocator(page, [
    "a:has-text('Перейти до пасажирів')",
    "a:has-text('Перейти к пассажирам')",
    "a:has-text('Go to passengers')"
  ]);

  if (!goToPassengers) {
    throw new Error("Не нашли ссылку «Перейти до пасажирів».");
  }

  await page.waitForTimeout(2000);
  await goToPassengers.click();
  log("Перешли к заполнению пассажиров.");
}

async function fillPassengers(page, seatsToBook) {
  log("Заполняем пассажиров…");

  for (let i = 0; i < seatsToBook; i++) {
    const p = passengers[i];
    if (!p) break;

    const fn = page.locator("input[name='first_name'], #first_name");
    const ln = page.locator("input[name='last_name'], #last_name");
    const bd = page.locator("input[name='bdate'], #bdate");
    const dn = page.locator("input[name='docnum'], #docnum");

    await fn.waitFor({ state: "visible", timeout: 10000 });

    if (await fn.count()) { await fn.fill(p.firstName); await page.waitForTimeout(300); }
    if (await ln.count()) { await ln.fill(p.lastName); await page.waitForTimeout(300); }
    if (await bd.count()) { await bd.fill(p.birthDate); await page.waitForTimeout(300); }
    if (await dn.count()) { await dn.fill(p.document); await page.waitForTimeout(300); }

    log(`👤 Пассажир ${i + 1}: ${p.firstName} ${p.lastName} заполнен`);

    if (i < seatsToBook - 1) {
      const nextBtn = page.locator(`#submitPassenger-${i}`);
      if (await nextBtn.isVisible().catch(() => false)) {
        await nextBtn.click();
        log("➡️ Нажали «Наступний пасажир»");
        await page.waitForTimeout(1000);
      } else {
        log("⚠️ Не нашли кнопку «Наступний пасажир»");
      }
    }
  }

  log("✅ Все пассажиры заполнены.");
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 120 });
  const page = await browser.newPage();

  await page.goto("https://booking.uz.gov.ua/", { waitUntil: "domcontentloaded" });

  log("Заполняем форму поиска…");
  await selectCity(page, "Звідки", config.from);
  await selectCity(page, "Куди", config.to);

  await selectDate(page, config.date);

  const searchBtn = await firstVisibleLocator(page, [
    (p) => p.getByRole("button", { name: /Знайти|search/i }),
    "button:has-text('Пошук')",
    "button:has-text('Search')"
  ]);
  if (searchBtn) await searchBtn.click();
  else throw new Error("Не нашли кнопку «Пошук».");

  await chooseTrainWithMostSeats(page);

  const seatsToBook = Number(config.seats ?? 1);
  await pickSeats(page, seatsToBook);

  await fillPassengers(page, seatsToBook);

  console.log("✅ Готово. Проверь данные и переходи к оплате вручную.");
})().catch((e) => {
  console.error("❌ Ошибка:", e.message);
});
