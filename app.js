// =========================================================================
// Cserélj Okosan (csereljokosan.hu) - app.js (v5.0 TELJES KIADÁS)
// 1/4. RÉSZ: ADATBÁZIS, MOTOR, 80+ ALBUMREGISZTER ÉS NORMALIZÁLÓ
// =========================================================================

// Segédfüggvény a több mint 80 album helytakarékos és tiszta definiálásához
function createAlbumEntry(id, title, publisher, year, totalItems, type, coverUrl, opts = {}) {
  return {
    id,
    title,
    publisher: publisher || 'Egyéb',
    year: parseInt(year, 10) || 2026,
    totalItems: parseInt(totalItems, 10) || 100,
    type: type || 'sticker',
    typeLabel: type === 'sticker' ? 'Matricaalbum' : (type === 'card' ? 'Kártya' : (type === 'figure' ? 'Figura / Kinder' : 'Gyűjtemény')),
    coverUrl: coverUrl || 'og-image.png',
    subtitle: opts.subtitle || '',
    featured: opts.featured === true,
    isRetro: opts.isRetro === true || (parseInt(year, 10) < 2018),
    hasFavorites: opts.hasFavorites !== false,
    hasRadar: opts.hasRadar === true,
    radarType: opts.radarType || 'none',
    hasChapters: opts.hasChapters === true,
    customItems: opts.customItems || [],
    customNames: opts.customNames || [],
    customChaptersList: opts.customChaptersList || []
  };
}

let ALBUMS_REGISTRY = {
  // --- KIEMELT KAMPÁNYOK & ALAPALBUMOK ---
  "lidl-lutra-2026": createAlbumEntry("lidl-lutra-2026", "Lutra Album", "Lidl / WWF", 2026, 108, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F08cfa8f7-c4f1-4d02-bf25-2719f2d5dfca.png&w=3840&q=75", { featured: true, hasRadar: true, radarType: "lidl", hasChapters: true, subtitle: "Védett állatok a Föld körül" }),
  "garfield-mentsuk-meg-a-bolygot-2026": createAlbumEntry("garfield-mentsuk-meg-a-bolygot-2026", "Garfield - Mentsük meg a bolygót 2026", "Spar", 2026, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F130c309d-cda4-435f-8112-51b236ec8880.jpg&w=3840&q=75", { featured: true, hasRadar: true, radarType: "spar" }),
  "panini-fifa-world-cup-2026": createAlbumEntry("panini-fifa-world-cup-2026", "FIFA World Cup 2026 Matricaalbum", "Panini", 2026, 1345, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F6e6fdbf7-9a10-4a50-8337-f54e867ba053.jpg&w=3840&q=75", { featured: true, hasRadar: true, radarType: "retail_general" }),
  "fifa-world-cup-2026-adrenalyn-xl": createAlbumEntry("fifa-world-cup-2026-adrenalyn-xl", "FIFA World Cup 2026 – Adrenalyn XL", "Panini", 2026, 630, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ffifa-world-cup-2026-adrenalyn-xl.webp&w=3840&q=75", { featured: true, hasRadar: true, radarType: "retail_general" }),
  "topps-match-attax-uefa-champions-league-2025-26": createAlbumEntry("topps-match-attax-uefa-champions-league-2025-26", "Topps Match Attax UEFA Champions League 2025/26", "Topps", 2025, 743, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F0e1d4a44-674c-4dbf-8165-d1848067514f.jpg&w=3840&q=75", { featured: true }),
  "toy-story-5": createAlbumEntry("toy-story-5", "Toy Story 5", "Panini", 2026, 192, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F10110c3c-f734-4083-a1a1-14762ecda0c5.jpg&w=3840&q=75", { featured: true }),
  "mancs-orjarat-2026": createAlbumEntry("mancs-orjarat-2026", "Mancs őrjárat - Legizgalmasabb kalandok!", "Panini", 2026, 184, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F3a6ea592-5bb6-411f-88ef-d4bcd2f31823.jpg&w=3840&q=75"),

  // --- KÁRTYAGYŰJTEMÉNYEK (TOPPS, PANINI, F1, RETRO) ---
  "topps-flagship-premier-league-2026-27": createAlbumEntry("topps-flagship-premier-league-2026-27", "Topps Flagship Premier League 2026/27", "Topps", 2026, 734, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ftopps-premier-league-202627-flagship-edition.webp&w=3840&q=75"),
  "topps-match-attax-extra-2025-2026": createAlbumEntry("topps-match-attax-extra-2025-2026", "Topps Match Attax Extra 2025/2026", "Topps", 2025, 420, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F4931c9a8-6cbd-4396-90f5-b8815b0e04b5.jpg&w=3840&q=75"),
  "topps-turbo-attax-official-formula-1-2026": createAlbumEntry("topps-turbo-attax-official-formula-1-2026", "Topps Turbo Attax Official Formula 1 2026", "Topps", 2026, 353, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fda69f746-d909-4691-b14a-a73ebfcf530a.webp&w=3840&q=75"),
  "fifa-club-world-cup-2025": createAlbumEntry("fifa-club-world-cup-2025", "FIFA Club World Cup 2025 – Adrenalyn XL", "Panini", 2025, 387, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F91b669c0-41bc-4c83-a24d-36c3504e5b16.png&w=3840&q=75"),
  "fifa-365-2027-adrenalyn-xl": createAlbumEntry("fifa-365-2027-adrenalyn-xl", "FIFA 365 2027 – Adrenalyn XL", "Panini", 2026, 555, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F8bd6b2fc-57db-48dd-b66d-82302537172c.webp&w=3840&q=75"),
  "fifa-365-2026-adrenalyn-xl": createAlbumEntry("fifa-365-2026-adrenalyn-xl", "FIFA 365 2026 – Adrenalyn XL", "Panini", 2025, 452, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fbcb13313-afad-4ac7-ae1c-5906c7ea5358.webp&w=3840&q=75"),
  "fifa-365-2021-2022": createAlbumEntry("fifa-365-2021-2022", "FIFA 365 2021–2022 – Adrenalyn XL", "Panini", 2022, 956, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F92806979-dbbc-4fa1-b909-d05093f7f088.webp&w=3840&q=75"),
  "fifa-365-2020-2021": createAlbumEntry("fifa-365-2020-2021", "FIFA 365 2020–2021 – Adrenalyn XL", "Panini", 2020, 735, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F9fb4e3ce-478b-4753-a194-251aedb5e676.webp&w=3840&q=75"),
  "uefa-euro-2024-match-attax": createAlbumEntry("uefa-euro-2024-match-attax", "UEFA Euro 2024 Match Attax", "Topps", 2024, 709, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fdd5774d7-8d13-4123-be3e-4f7b4629f3fa.jpg&w=3840&q=75"),
  "uefa-euro-2024-sticker": createAlbumEntry("uefa-euro-2024-sticker", "UEFA Euro 2024 Matricaalbum", "Topps", 2024, 707, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F104edc70-6403-4fcc-a279-d2c5b6dd569d.jpg&w=3840&q=75"),
  "dragon-ball-daima-2026": createAlbumEntry("dragon-ball-daima-2026", "Dragon Ball Daima 2026", "Panini", 2026, 416, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fdd454000-806d-43ab-a634-c17128e460e0.webp&w=3840&q=75"),
  "star-wars-az-ero-hatalma": createAlbumEntry("star-wars-az-ero-hatalma", "Star Wars: Az Erő Hatalma", "Egyéb", 2026, 72, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fe0b0d0ed-c744-4bd1-bb6d-e83713ee0e76.jpg&w=3840&q=75"),
  "stitch-good-vibes": createAlbumEntry("stitch-good-vibes", "Stitch Good Vibes!", "Panini", 2026, 227, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F9ddecc2a-e3e6-45cd-a6d0-505c212cd250.jpg&w=3840&q=75"),
  "stitch-amazing-worlds-photocards": createAlbumEntry("stitch-amazing-worlds-photocards", "Stitch Amazing Worlds Photocards", "Panini", 2025, 114, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F571f3622-c143-4eeb-a9a3-6115c8279e3a.jpg&w=3840&q=75"),
  "moomin-the-creative-world-of-moomin": createAlbumEntry("moomin-the-creative-world-of-moomin", "Moomin - The Creative World", "Panini", 2026, 225, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ffb512de7-c3df-41ac-9949-87dbc2f80727.jpg&w=3840&q=75"),
  "panini-superstars": createAlbumEntry("panini-superstars", "Panini Superstars", "Panini", 2016, 60, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F2470485c-ed8f-45b0-8ad7-f07f5b292f05.jpg&w=3840&q=75"),

  // --- SKIFIDOL BRAINROT KOLLEKCIÓK ---
  "skifidol-italian-brainrot-sticker-collection-2-szeria": createAlbumEntry("skifidol-italian-brainrot-sticker-collection-2-szeria", "Skifidol Italian Brainrot 2. széria", "Panini", 2026, 320, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fe4210a71-383b-46b4-8cec-915dccbbc1c1.jpg&w=3840&q=75"),
  "skifidol-italian-brainrot-sticker-collection": createAlbumEntry("skifidol-italian-brainrot-sticker-collection", "Skifidol Italian Brainrot 1. széria", "Panini", 2025, 300, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F5cc35a0d-441a-4caf-ab3e-dc188e3c8628.jpg&w=3840&q=75"),
  "skifidol-trading-card-psychedelic": createAlbumEntry("skifidol-trading-card-psychedelic", "Skifidol Brainrot TCG - Psychedelic Universe", "Panini", 2025, 150, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F0ba5d43e-e314-44da-8d3e-bf4123c1d0f3.jpg&w=3840&q=75"),
  "skifidol-trading-card-cosmic": createAlbumEntry("skifidol-trading-card-cosmic", "Skifidol Brainrot TCG - Cosmic Hallucination", "Panini", 2026, 150, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ffed62b90-ceef-4604-9f62-ae1b7b0af819.jpg&w=3840&q=75"),

  // --- RETRO SPAR GYŰJTEMÉNYEK (GARFIELD ÉS MÁNIÁK) ---
  "garfield-magyarorszag": createAlbumEntry("garfield-magyarorszag", "Garfield - Magyarország", "Spar", 2026, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F07287733-3f12-45b3-9cee-a56ec03a111c.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-allati-rekordok-2": createAlbumEntry("garfield-allati-rekordok-2", "Garfield - Állati rekordok 2", "Spar", 2025, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fcc29ba2f-339e-404e-8587-0d86be878648.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "hol-vagy-kajla": createAlbumEntry("hol-vagy-kajla", "Hol vagy Kajla?", "Spar", 2019, 241, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F7a884f66-115c-4254-94e3-ef98f8795aa3.png&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "meses-szakacskonyv-es-matricagyujto-album": createAlbumEntry("meses-szakacskonyv-es-matricagyujto-album", "Mesés szakácskönyv és matricagyűjtő", "Spar", 2018, 232, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F239b26c4-db79-42c4-8a3f-5cc24c3edce3.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-rejtelymania": createAlbumEntry("garfield-rejtelymania", "Garfield - Rejtélymánia", "Spar", 2017, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F95348744-3d51-4303-9205-4eca8ff48655.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "allati-rekordok": createAlbumEntry("allati-rekordok", "Állati rekordok", "Spar", 2016, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F7eb6eef5-5f6f-4144-9a82-db387ace1bd2.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-hegymania": createAlbumEntry("garfield-hegymania", "Garfield - Hegymánia", "Spar", 2014, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fc83548f4-48e2-4c31-a642-9a3663c547ef.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "szigetmania": createAlbumEntry("szigetmania", "Szigetmánia", "Spar", 2014, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F0e64fd31-5ea7-410c-ad6a-712d827d6a67.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-oceanmania": createAlbumEntry("garfield-oceanmania", "Garfield - Óceánmánia", "Spar", 2013, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fb9b544e9-fea3-4ad4-952b-2bd7b55fb863.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-szafarimania": createAlbumEntry("garfield-szafarimania", "Garfield - Szafarimánia", "Spar", 2012, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F7e261272-5e86-4ee7-9122-39a68d033ae7.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),
  "garfield-dzsungel-mania": createAlbumEntry("garfield-dzsungel-mania", "Garfield - Dzsungelmánia", "Spar", 2011, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F660fbb5a-24fe-4987-9f86-b07c73e46d8a.jpg&w=3840&q=75", { hasRadar: true, radarType: "spar" }),

  // --- SOROZATOK, ANIMÁCIÓK, DISNEY, RETRO & GYEREK ---
  "stranger-things-adventure-2026": createAlbumEntry("stranger-things-adventure-2026", "Stranger Things - One last strange adventure", "Panini", 2026, 211, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F1251cfb7-1e8c-4ec1-b908-ec680b16b9ec.jpg&w=3840&q=75"),
  "stranger-things-this-is-our-story": createAlbumEntry("stranger-things-this-is-our-story", "Stranger Things - This is our story", "Panini / Netflix", 2025, 235, "card", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F95876896-c91c-4a6d-9f5f-1c931898f912.webp&w=3840&q=75"),
  "super-mario-it-s-a-me-mario": createAlbumEntry("super-mario-it-s-a-me-mario", "Super Mario - It's-a me, Mario!", "Panini", 2026, 180, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F571f40ae-b90d-4bdd-85ea-6bca1cea22b1.jpg&w=3840&q=75"),
  "super-mario-play-time": createAlbumEntry("super-mario-play-time", "Super Mario - Play Time", "Panini", 2023, 304, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fa78d1751-5e02-4740-a960-360bc2408505.webp&w=3840&q=75"),
  "lego-ninjago-dragons-rising": createAlbumEntry("lego-ninjago-dragons-rising", "Lego Ninjago - Dragons Rising", "Egyéb", 2025, 212, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fce4d3f5d-3b8d-4210-9bb5-70d5bb3fdd99.webp&w=3840&q=75"),
  "lego-ninjago-15-eves-jubileumi": createAlbumEntry("lego-ninjago-15-eves-jubileumi", "Lego Ninjago - 15 éves jubileumi", "Egyéb", 2026, 212, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F1bad8ce8-f850-42bf-a0a4-ef472fb3c90a.webp&w=3840&q=75"),
  "miraculous-stronger-together": createAlbumEntry("miraculous-stronger-together", "Miraculous - Stronger Together", "Panini", 2025, 212, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fcac20106-a68d-4201-9058-b1f8790b993e.webp&w=3840&q=75"),
  "miraculous-friends-forever": createAlbumEntry("miraculous-friends-forever", "Miraculous - Friends Forever", "Panini", 2026, 160, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F80bb7643-9f31-4e99-98fa-315927e6a1d3.webp&w=3840&q=75"),
  "miraculous-a-talizmanok-orzoje": createAlbumEntry("miraculous-a-talizmanok-orzoje", "Miraculous - A talizmánok őrzője", "Panini", 2022, 246, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F08cb56bb-a0f3-4ad6-9a62-73569f856f94.jpg&w=3840&q=75"),
  "miraculous-super-heroez-team": createAlbumEntry("miraculous-super-heroez-team", "Miraculous - Super Heroez Team", "Panini", 2021, 192, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F7657d776-b1fb-42c8-bc8e-81f9ba631d2c.jpg&w=3840&q=75"),
  "miraculous-heroez-in-the-world": createAlbumEntry("miraculous-heroez-in-the-world", "Miraculous - Heroez in the World", "Panini", 2022, 192, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F99411a25-4a72-43a9-8cf5-52bad6af33c9.jpg&w=3840&q=75"),
  "mancs-orjarat-kamionos-kutyik": createAlbumEntry("mancs-orjarat-kamionos-kutyik", "Mancs őrjárat - Kamionos kutyik", "Panini", 2023, 176, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fmancs-orjarat-kamionos-kutyik.webp&w=3840&q=75"),
  "mancs-orjarat-mentolovagok": createAlbumEntry("mancs-orjarat-mentolovagok", "Mancs őrjárat - Mentőlovagok", "Panini", 2023, 176, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F4c90c3ab-96b9-4b7f-a812-c75a13f5eb42.jpg&w=3840&q=75"),
  "monster-high-we-are": createAlbumEntry("monster-high-we-are", "Monster High - We are", "Panini", 2014, 192, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F5a36d216-5942-4694-a339-347b3ed951a7.jpg&w=3840&q=75"),
  "ragyogo-hercegnok": createAlbumEntry("ragyogo-hercegnok", "Disney - Ragyogó Hercegnők", "Panini", 2013, 240, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F76b727f1-ede2-4976-b3b7-db74d86024e6.jpg&w=3840&q=75"),
  "a-szepseg-es-a-szornyeteg": createAlbumEntry("a-szepseg-es-a-szornyeteg", "A Szépség és a Szörnyeteg", "Panini", 2017, 180, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fd92929d6-a56c-457e-90bf-d79a08d779c7.jpg&w=3840&q=75"),
  "a-hihetetlen-csalad-2": createAlbumEntry("a-hihetetlen-csalad-2", "A hihetetlen család 2.", "Panini", 2018, 192, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F6e84fede-c5c8-4b52-821a-c8860067afd8.jpg&w=3840&q=75"),
  "a-kis-kedvencek-titkos-elete": createAlbumEntry("a-kis-kedvencek-titkos-elete", "A kis kedvencek titkos élete", "Panini", 2016, 180, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fcd392a31-d5ac-49c4-9f11-0309508610d8.jpg&w=3840&q=75"),
  "angry-birds-go": createAlbumEntry("angry-birds-go", "Angry Birds Go!", "Egyéb", 2013, 208, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fcf19acc1-bafa-46a2-94d1-ee780957c871.jpg&w=3840&q=75"),
  "angry-birds": createAlbumEntry("angry-birds", "Angry Birds", "Egyéb", 2012, 178, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F29b48091-5388-4666-a4ad-5676ff4da6df.webp&w=3840&q=75"),
  "trolls": createAlbumEntry("trolls", "Trolls", "Topps", 2016, 180, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fdfab26c4-48d7-4def-a366-4c366d9cfc6c.jpg&w=3840&q=75"),
  "fogadd-el-a-furcsasagodat": createAlbumEntry("fogadd-el-a-furcsasagodat", "Fogadd el a furcsaságodat!", "Panini", 2024, 192, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fc6a53ea9-bb6a-487a-b0c3-0db713a60545.jpg&w=3840&q=75"),
  "disney-100-ev-varazslat": createAlbumEntry("disney-100-ev-varazslat", "Disney 100 év varázslat", "Spar", 2023, 144, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F499e8d3d-b153-4712-8ff8-9f16ac8877a3.jpg&w=3840&q=75"),
  "harry-potter-varazslatos-baratsagok": createAlbumEntry("harry-potter-varazslatos-baratsagok", "Harry Potter Varázslatos Barátságok", "Spar", 2022, 120, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F67e264a6-2a98-46b8-9219-7baa7294a952.jpg&w=3840&q=75"),
  "k-pop-demon-hunters": createAlbumEntry("k-pop-demon-hunters", "K-POP Demon Hunters", "Egyéb", 2026, 196, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F447764ee-e177-4578-89e9-a9ca8c12eef6.jpg&w=3840&q=75"),
  "animal-planet-a-vilag-csodalatos-allatai": createAlbumEntry("animal-planet-a-vilag-csodalatos-allatai", "Animal Planet - Csodálatos állatok", "Egyéb", 2012, 196, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fe08eabe4-208d-4c37-966a-fc7cc7c1eb72.jpg&w=3840&q=75"),
  "animals-a-lenyugozo-vadvilag-belulrol": createAlbumEntry("animals-a-lenyugozo-vadvilag-belulrol", "Animals - Vadvilág belülről", "Panini", 2026, 552, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F27ee5f9a-d002-4d28-9fce-32fcd5bc7949.jpg&w=3840&q=75"),
  "allatkolykok-vilaga": createAlbumEntry("allatkolykok-vilaga", "Állatkölykök világa", "Egyéb", 2014, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fb16874a6-7607-46b3-9aa5-f83ffd101644.jpg&w=3840&q=75"),
  "a-mi-foldunk-kalandos-utazas": createAlbumEntry("a-mi-foldunk-kalandos-utazas", "A Mi Földünk - Kalandos utazás!", "Egyéb", 2013, 210, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F2b5bf5fc-2fab-4523-99ca-1689d5ddd695.jpg&w=3840&q=75"),
  "arnold-es-oszkar-foldon-vizen-levegoben": createAlbumEntry("arnold-es-oszkar-foldon-vizen-levegoben", "Arnold és Oszkár - Földön, vízen, levegőben", "Egyéb", 2015, 166, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F6f8abd59-143f-4966-a03f-48c478dc645f.jpg&w=3840&q=75"),
  "arnold-es-oszkar-utazasa-az-idoben": createAlbumEntry("arnold-es-oszkar-utazasa-az-idoben", "Arnold és Oszkár utazása az időben", "Egyéb", 2014, 166, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F516cd83a-1ef7-4d87-a9dd-700d06c36cba.jpg&w=3840&q=75"),
  "kutyatar": createAlbumEntry("kutyatar", "Kutyatár", "Egyéb", 2026, 200, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F1ee08ca7-b7af-479c-8d38-31109b5dedfb.jpg&w=3840&q=75"),
  "one-piece-sticker": createAlbumEntry("one-piece-sticker", "One Piece Matricaalbum", "Egyéb", 2026, 185, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F9f564dfb-d4b7-4ee1-9c93-08a2c2b9fa11.webp&w=3840&q=75"),
  "lenyugozo-autok-a-nagyvilagbol": createAlbumEntry("lenyugozo-autok-a-nagyvilagbol", "Lenyűgöző autók a nagyvilágból", "Panini", 2026, 120, "sticker", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fa516ed9b-ff50-404d-81ca-327d6ec4245d.jpg&w=3840&q=75"),

  // --- FIGURÁK, KINDER ÉS KISAUTÓK (HOT WHEELS) ---
  "one-piece-kinder": createAlbumEntry("one-piece-kinder", "One Piece Kinder Joy", "Kinder", 2026, 25, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fdc648487-9950-4179-a2f8-4a96cf8a7283.webp&w=3840&q=75"),
  "minecraft-kinder-joy": createAlbumEntry("minecraft-kinder-joy", "Minecraft Kinder Joy", "Kinder", 2026, 28, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fe6ed94a7-8dd0-4a50-90de-8b92a592c06d.webp&w=3840&q=75"),
  "playmobil-dc": createAlbumEntry("playmobil-dc", "Playmobil DC", "Kinder", 2025, 16, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2F4d3513ad-5e23-4f28-a030-b6d27a5b4bf5.jpg&w=3840&q=75"),
  "kinder-joy-stranger-things": createAlbumEntry("kinder-joy-stranger-things", "Kinder Joy - Stranger Things", "Kinder", 2025, 24, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Ff0a5ec87-ba81-48d7-ac5e-59b30846a6b2.webp&w=3840&q=75"),
  "kinder-meglepetes-natoons-szavanna": createAlbumEntry("kinder-meglepetes-natoons-szavanna", "Kinder Meglepetés - Natoons Szavanna", "Kinder", 2026, 16, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fkinder-meglepetes-natoons-szavanna.webp&w=3840&q=75"),
  "kinder-meglepetes-star-wars": createAlbumEntry("kinder-meglepetes-star-wars", "Kinder Meglepetés - Star Wars", "Kinder", 2025, 10, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Feb841a57-6edf-4cf7-bcb5-6cd411728913.png&w=3840&q=75"),
  "kinder-meglepetes-disney-playmobil": createAlbumEntry("kinder-meglepetes-disney-playmobil", "Kinder Meglepetés - Disney Playmobil", "Kinder", 2026, 18, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fkinder-meglepetes-disney-playmobil.webp&w=3840&q=75"),
  "hot-wheels-2026": createAlbumEntry("hot-wheels-2026", "Hot Wheels 2026 Kisautók", "Mattel", 2026, 386, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fhot-wheels-2026-logo.webp&w=3840&q=75", { subtitle: "Kisautó gyűjtemény" }),
  "hot-wheels-super-treasure-hunt-2026": createAlbumEntry("hot-wheels-super-treasure-hunt-2026", "Hot Wheels Super Treasure Hunt 2026", "Mattel", 2026, 15, "figure", "https://gyujtoklub.hu/_next/image?url=%2Fuploads%2Fcollections%2Fhot-wheels-super-treasure-hunt-2026-logo.webp&w=3840&q=75", { subtitle: "Ritka prémium kisautók" })
};

let currentAlbumId = localStorage.getItem('lutra_active_album') || "lidl-lutra-2026";
let currentHubFilter = "all";
let showAllHubAlbums = false;
let editingAlbumId = null;
let saveDebounceTimer = null;
let lastLocalEditTimestamp = 0; // 🛡️ Helyi szerkesztési védőidő a Firestore visszaszinkron ellen

// GPS, TÁVOLSÁGI & SZŰRŐ ÁLLAPOTOK
let myGpsCoords = safeJsonParse('cserelj_gps_coords', null);
let selectedSearchRadius = 'all';
let selectedCityFilter = '';
let selectedNameQuery = '';

function getActiveAlbum() {
  return ALBUMS_REGISTRY[currentAlbumId] || ALBUMS_REGISTRY["lidl-lutra-2026"];
}

function getActiveAlbumSize() {
  return getActiveAlbum().totalItems;
}

function getAlbumDisplayTitle(albumId) {
  const alb = ALBUMS_REGISTRY[albumId];
  if (!alb) return albumId ? `Gyűjtemény (${albumId})` : 'Lutra Album (2026)';
  return `${alb.title} (${alb.year})`;
}

const ADMIN_EMAIL = "gyorgy.harkai@gmail.com";
const WORKER_ENDPOINT_URL = "https://blue-bread-cef1.gyorgy-harkai.workers.dev";

// KOORDINÁTA-TÁR (LEAFLET TÉRKÉPHEZ ÉS TÁVOLSÁGMÉRÉSHEZ)
const CITY_COORDINATES = {
  "budapest": { lat: 47.4979, lng: 19.0402, x: 52.5, y: 39.0 },
  "budapest_1": { lat: 47.496, lng: 19.038 }, "budapest_2": { lat: 47.530, lng: 18.990 },
  "budapest_3": { lat: 47.560, lng: 19.040 }, "budapest_4": { lat: 47.565, lng: 19.090 },
  "budapest_5": { lat: 47.499, lng: 19.052 }, "budapest_6": { lat: 47.506, lng: 19.062 },
  "budapest_7": { lat: 47.502, lng: 19.080 }, "budapest_8": { lat: 47.490, lng: 19.085 },
  "budapest_9": { lat: 47.470, lng: 19.080 }, "budapest_10": { lat: 47.485, lng: 19.145 },
  "budapest_11": { lat: 47.465, lng: 19.030 }, "budapest_12": { lat: 47.495, lng: 18.995 },
  "budapest_13": { lat: 47.535, lng: 19.075 }, "budapest_14": { lat: 47.520, lng: 19.120 },
  "budapest_15": { lat: 47.555, lng: 19.135 }, "budapest_16": { lat: 47.525, lng: 19.200 },
  "budapest_17": { lat: 47.480, lng: 19.260 }, "budapest_18": { lat: 47.435, lng: 19.185 },
  "budapest_19": { lat: 47.450, lng: 19.145 }, "budapest_20": { lat: 47.435, lng: 19.110 },
  "budapest_21": { lat: 47.415, lng: 19.070 }, "budapest_22": { lat: 47.420, lng: 19.020 },
  "budapest_23": { lat: 47.395, lng: 19.130 },
  "gyor": { lat: 47.6875, lng: 17.6504 }, "sopron": { lat: 47.6865, lng: 16.5843 },
  "szombathely": { lat: 47.2307, lng: 16.6218 }, "zalaegerszeg": { lat: 46.8417, lng: 16.8416 },
  "veszprem": { lat: 47.0933, lng: 17.9115 }, "szekesfehervar": { lat: 47.1860, lng: 18.4221 },
  "pecs": { lat: 46.0727, lng: 18.2323 }, "kaposvar": { lat: 46.3594, lng: 17.7968 },
  "szekszard": { lat: 46.3501, lng: 18.7091 }, "kecskemet": { lat: 46.9069, lng: 19.6913 },
  "nagykörös": { lat: 47.0322, lng: 19.7828 }, "nagykoros": { lat: 47.0322, lng: 19.7828 },
  "cegled": { lat: 47.1742, lng: 19.7997 }, "kiskunfelegyhaza": { lat: 46.7119, lng: 19.8456 },
  "lajosmizse": { lat: 47.0256, lng: 19.5583 }, "dabas": { lat: 47.1878, lng: 19.3139 },
  "albertirsa": { lat: 47.2417, lng: 19.6167 }, "tiszakecske": { lat: 46.9317, lng: 20.0911 },
  "kiskunmajsa": { lat: 46.4917, lng: 19.7389 }, "kiskoros": { lat: 46.6214, lng: 19.2853 },
  "solt": { lat: 46.8000, lng: 19.0000 }, "soltvadkert": { lat: 46.5778, lng: 19.3944 },
  "szeged": { lat: 46.2530, lng: 20.1414 }, "bekescsaba": { lat: 46.6796, lng: 21.0911 },
  "szolnok": { lat: 47.1756, lng: 20.1764 }, "debrecen": { lat: 47.5316, lng: 21.6273 },
  "nyiregyhaza": { lat: 47.9554, lng: 21.7167 }, "miskolc": { lat: 48.1035, lng: 20.7784 },
  "eger": { lat: 47.9025, lng: 20.3772 }, "salgotarjan": { lat: 48.0934, lng: 19.8030 },
  "tatabanya": { lat: 47.5849, lng: 18.3932 }, "erd": { lat: 47.3789, lng: 18.9192 },
  "budaors": { lat: 47.4625, lng: 18.9536 }, "szentendre": { lat: 47.6667, lng: 19.0833 },
  "dunakeszi": { lat: 47.6333, lng: 19.1333 }, "godollo": { lat: 47.6000, lng: 19.3667 },
  "szigetszentmiklos": { lat: 47.3439, lng: 19.0436 }, "dunaujvaros": { lat: 46.9619, lng: 18.9355 },
  "baja": { lat: 46.1819, lng: 18.9568 }, "hodmezovasarhely": { lat: 46.4303, lng: 20.3189 },
  "oroshaza": { lat: 46.5667, lng: 20.6667 }, "gyula": { lat: 46.6500, lng: 21.2833 },
  "siofok": { lat: 46.9041, lng: 18.0580 }, "keszthely": { lat: 46.7691, lng: 17.2481 },
  "nagykanizsa": { lat: 46.4535, lng: 16.9910 }
};

// 221 LIDL BOLTLISTA
const STORE_DATABASES = {
  "lidl": [
    "Agárd – Akácfa utca 2.", "Ajka – Hársfa utca 1/A", "Aszód – Pesti út 14-16.", "Baja – Bajcsy-Zsilinszky utca 9.",
    "Balassagyarmat – Kóvári út 8", "Balatonfűzfő – Vízmű utca 1.", "Balatonlelle – Rákóczi F. út 307.",
    "Békéscsaba – Corvin u. 29-33.", "Biatorbágy – Budaörsi út 4.", "Bicske – Szent László utca 55.",
    "Budakeszi – Kert utca 27-29.", "Budaörs – Károly király út 145.", "Budapest – Ady Endre út 54-60.",
    "Budapest – Bartók Béla út 47.", "Budapest – Bécsi út 325-337.", "Budapest – Fehérvári út 211.",
    "Budapest – Ferenciek tere 2.", "Budapest – Gubacsi út 34.", "Budapest – Király u. 112.",
    "Budapest – Mogyoródi út 23-29", "Budapest – Pesti út 237/H", "Budapest – Rákóczi út 48-50.",
    "Budapest – Váci út 201", "Cegléd – Törteli út 2.", "Debrecen – Mikepércsi út 168.", "Dunaújváros – Magyar út 11.",
    "Eger – Mátyás király út 144.", "Érd – Balatoni út 73-75.", "Esztergom – Dobogókői út 39.", "Gödöllő – Ottó Ferenc utca 2-4.",
    "Győr – Jereváni utca 42.", "Hódmezővásárhely – Hódtó u. 2.", "Kaposvár – Füredi út 97.", "Kecskemét – Izsáki út 2.",
    "Keszthely – Sopron utca 43.", "Miskolc – József Attila u. 74.", "Nyíregyháza – Debreceni u. 106/c.",
    "Pécs – Lázár Vilmos utca 10.", "Siófok – Zamárdi utca 1-2.", "Sopron – Bánfalvi út 12.", "Szeged – Makkosházi krt. 21.",
    "Székesfehérvár – Balatoni út 21.", "Szolnok – Széchenyi krt. 4/b.", "Szombathely – Zanati út 42", "Tatabánya – Győri út 31.",
    "Vác – Bolgár u. 1.", "Veszprém – Cholnoky utca 29/1.", "Zalaegerszeg – Átkötő utca 3."
  ],
  "spar": [
    "Budapest – Allee Interspar", "Budapest – Árkád Interspar", "Budapest – Westend Spar", "Budapest – Mammut Spar",
    "Debrecen – Fórum Spar", "Győr – Interspar", "Szeged – Árkád Spar", "Pécs – Árkád Interspar", "Kecskemét – Malom Spar"
  ],
  "retail_general": [
    "Relay / Inmedio újságosok", "Müller drogériák", "Tesco Hipermarketek", "Auchan áruházak", "Benzinkutak (OMV, MOL, Shell)"
  ]
};

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

const ROMAN_NUMERALS = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI", "XXII", "XXIII"];

const KNOWN_CANONICAL_CITIES = {
  "erd": "Érd", "gyor": "Győr", "pecs": "Pécs", "szeged": "Szeged", "debrecen": "Debrecen", "miskolc": "Miskolc",
  "kecskemet": "Kecskemét", "szekesfehervar": "Székesfehérvár", "szombathely": "Szombathely", "nyiregyhaza": "Nyíregyháza",
  "szolnok": "Szolnok", "tatabanya": "Tatabánya", "kaposvar": "Kaposvár", "bekescsaba": "Békéscsaba", "veszprem": "Veszprém",
  "zalaegerszeg": "Zalaegerszeg", "eger": "Eger", "sopron": "Sopron", "nagykanizsa": "Nagykanizsa", "dunaujvaros": "Dunaújváros",
  "hodmezovasarhely": "Hódmezővásárhely", "salgotarjan": "Salgótarján", "szekszard": "Szekszárd", "baja": "Baja", "siofok": "Siófok",
  "gyula": "Gyula", "oroshaza": "Orosháza", "keszthely": "Keszthely", "nagykoros": "Nagykőrös", "cegled": "Cegléd",
  "kiskunfelegyhaza": "Kiskunfélegyháza", "lajosmizse": "Lajosmizse", "dabas": "Dabas", "albertirsa": "Albertirsa",
  "tiszakecske": "Tiszakécske", "kiskunmajsa": "Kiskunmajsa", "kiskoros": "Kiskőrös", "budaors": "Budaörs",
  "szentendre": "Szentendre", "dunakeszi": "Dunakeszi", "godollo": "Gödöllő", "szigetszentmiklos": "Szigetszentmiklós"
};

function normalizeText(text) {
  if (!text) return '';
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function parseBudapestDistricts(text) {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/kerület|kerulet|ker\.?|district/g, ' ');
  const districts = [];
  const romanMap = { xxiii: 23, xxii: 22, xxi: 21, xx: 20, xix: 19, xviii: 18, xvii: 17, xvi: 16, xv: 15, xiv: 14, xiii: 13, xii: 12, xi: 11, x: 10, ix: 9, viii: 8, vii: 7, vi: 6, v: 5, iv: 4, iii: 3, ii: 2, i: 1 };
  const romanMatches = clean.match(/\b(xxiii|xxii|xxi|xx|xix|xviii|xvii|xvi|xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)\b/g);
  if (romanMatches) romanMatches.forEach(r => { if (romanMap[r]) districts.push(romanMap[r]); });
  const arabMatches = clean.match(/\b([1-9]|1[0-9]|2[0-3])\b/g);
  if (arabMatches) arabMatches.forEach(n => districts.push(parseInt(n, 10)));
  return [...new Set(districts)].sort((a, b) => a - b);
}

function extractNormalizedLocations(locationInput) {
  if (!locationInput) return [];
  const results = [];
  const SPLIT_REGEX = /[\/,;\\\+\-–—]|\bés\b|\bill\.?\b|\bvalamint\b/i;
  let rawList = [];

  if (Array.isArray(locationInput)) {
    locationInput.forEach(loc => {
      if (typeof loc === 'string') loc.split(SPLIT_REGEX).forEach(t => { if (t.trim()) rawList.push(t.trim()); });
      else if (loc && loc.city) {
        if (loc.districts && loc.districts.length > 0) loc.districts.forEach(d => rawList.push(`Budapest ${d}. kerület`));
        else loc.city.split(SPLIT_REGEX).forEach(t => { if (t.trim()) rawList.push(t.trim()); });
      }
    });
  } else if (typeof locationInput === 'string') {
    rawList = locationInput.split(SPLIT_REGEX).map(t => t.trim()).filter(t => t.length > 0);
  }

  rawList.forEach(raw => {
    const norm = normalizeText(raw);
    if (!norm) return;
    const isBp = norm.includes('budapest') || norm.includes('bp') || norm.includes('pest') || /^[0-9ivx\.\s\-]+ker/.test(norm);
    if (isBp) {
      const districts = parseBudapestDistricts(raw);
      if (districts.length > 0) {
        districts.forEach(d => results.push({ canonicalKey: `budapest_${d}`, displayName: `Budapest ${ROMAN_NUMERALS[d]}. kerület`, cityGroup: "Budapest" }));
      } else {
        results.push({ canonicalKey: `budapest`, displayName: `Budapest`, cityGroup: "Budapest" });
      }
    } else if (norm.includes('erd')) {
      results.push({ canonicalKey: 'erd', displayName: 'Érd', cityGroup: 'Érd' });
    } else if (norm.includes('gyor')) {
      results.push({ canonicalKey: 'gyor', displayName: 'Győr', cityGroup: 'Győr' });
    } else {
      const cleanKey = norm.replace(/[\s\.\-]+/g, '');
      const prettyName = KNOWN_CANONICAL_CITIES[cleanKey] || raw.charAt(0).toUpperCase() + raw.slice(1);
      results.push({ canonicalKey: cleanKey, displayName: prettyName, cityGroup: prettyName });
    }
  });

  const uniqueMap = new Map();
  results.forEach(item => { if (!uniqueMap.has(item.canonicalKey)) uniqueMap.set(item.canonicalKey, item); });
  return Array.from(uniqueMap.values());
}

function extractCanonicalCities(locationInput) {
  const normList = extractNormalizedLocations(locationInput);
  const result = [];
  normList.forEach(item => {
    result.push(item.canonicalKey);
    if (item.cityGroup === 'Budapest') result.push('budapest');
  });
  return [...new Set(result)];
}

function isLocalCityMatch(locA, locB) {
  const citiesA = extractCanonicalCities(locA);
  const citiesB = extractCanonicalCities(locB);
  if (citiesA.length === 0 || citiesB.length === 0) return false;
  return citiesA.some(cA => citiesB.includes(cA));
}

function getItemLabel(num, albumId = currentAlbumId) {
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customItems && album.customItems[num - 1]) {
    const raw = album.customItems[num - 1];
    return raw.startsWith('#') ? raw : `#${raw}`;
  }
  return `#${num}`;
}

function getItemFullName(num, albumId = currentAlbumId) {
  if (albumId === 'lidl-lutra-2026') {
    return STICKER_NAMES[num] ? `#${num} ${STICKER_NAMES[num]}` : `#${num}`;
  }
  const album = ALBUMS_REGISTRY[albumId];
  if (album && album.customNames && album.customNames[num - 1]) {
    return `${getItemLabel(num, albumId)} ${album.customNames[num - 1]}`;
  }
  return getItemLabel(num, albumId);
}

function expandCustomItemsText(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const tokens = rawText.split(/[\n,;]+/).map(t => t.trim()).filter(t => t.length > 0);
  const result = [];

  tokens.forEach(token => {
    const rangeMatch = token.match(/^([A-Za-z0-9_\s]+?)\s*(\d+)[\s\-—–]+(\d+)$/);
    if (rangeMatch) {
      const prefix = rangeMatch[1].trim();
      const start = parseInt(rangeMatch[2], 10);
      const end = parseInt(rangeMatch[3], 10);
      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) result.push(`${prefix} ${i}`);
    } else {
      result.push(token);
    }
  });
  return result;
}

function expandCustomNamesText(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const mapByIndex = {};
  let maxIndexFound = 0;
  let hasIndexedNames = false;
  let match;

  const regexNamed = /(?:^|\s+|,\s*)(?:#?(\d+))[\s:\.\-—–\t]+([^#\n\r]+?)(?=(?:\s+#?\d+[\s:\.\-—–\t]+)|$|,|\n)/g;

  if (/\d+[\s:\.\-—–\t]+/.test(rawText)) {
    while ((match = regexNamed.exec(rawText)) !== null) {
      const idx = parseInt(match[1], 10);
      const name = match[2].trim().replace(/^[,\s]+|[,\s]+$/g, '');
      if (idx > 0 && name.length > 0) {
        mapByIndex[idx] = name;
        if (idx > maxIndexFound) maxIndexFound = idx;
        hasIndexedNames = true;
      }
    }
  }

  if (hasIndexedNames && maxIndexFound > 0) {
    const indexedResult = [];
    for (let i = 1; i <= maxIndexFound; i++) indexedResult.push(mapByIndex[i] || '');
    return indexedResult;
  }

  return rawText.split(/[\n,;]+/).map(t => t.trim()).filter(t => t.length > 0);
}

function parseChaptersText(rawText, customItems = []) {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/[\r\n]+/);
  const chapters = [];

  lines.forEach((line, idx) => {
    line = line.trim();
    if (!line) return;
    const isCombo = line.toLowerCase().includes('[combo]');
    const cleanLine = line.replace(/\[combo\]/gi, '').trim();
    const rangeMatch = cleanLine.match(/(?:#?\s*)(\d+)[\s\-—–−]+(?:#?\s*)(\d+)/);
    if (!rangeMatch) return;

    const min = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
    const max = Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10));
    let title = cleanLine.replace(/(?:#?\s*)(\d+)[\s\-—–−]+(?:#?\s*)(\d+)/g, '').replace(/^[\s:\.\-—–]+|[\s:\.\-—–]+$/g, '').trim() || `${idx + 1}. fejezet`;

    const elements = [];
    if (isCombo && max - min === 1) {
      elements.push({ type: "combo", nums: [min, max], name: title, orient: "panoráma" });
    } else {
      for (let n = min; n <= max; n++) {
        elements.push({ type: "single", num: n, name: customItems[n - 1] || `#${n}`, orient: "négyzet" });
      }
    }
    if (elements.length > 0) chapters.push({ id: `chap_${idx + 1}`, cim: title, elemek: elements });
  });

  return chapters;
}

function getActiveChapters() {
  const activeAlbum = getActiveAlbum();
  if (currentAlbumId === 'lidl-lutra-2026') return FEJEZETEK;
  if (activeAlbum.type === 'sticker' && activeAlbum.customChaptersList && activeAlbum.customChaptersList.length > 0) {
    return activeAlbum.customChaptersList;
  }
  return [];
}

function safeAddListener(id, eventOrHandler, handler) {
  const el = document.getElementById(id);
  if (!el) return;
  if (typeof eventOrHandler === 'function') el.addEventListener('click', eventOrHandler);
  else if (typeof eventOrHandler === 'string' && typeof handler === 'function') el.addEventListener(eventOrHandler, handler);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function ensureArray(val) {
  if (!val) return [];
  const maxLimit = typeof getActiveAlbumSize === 'function' ? getActiveAlbumSize() : 2000;
  if (Array.isArray(val)) {
    return val.map(item => parseInt(String(item).replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  if (typeof val === 'string') {
    return val.split(/[\s,;]+/).map(token => parseInt(String(token).replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  if (typeof val === 'object') {
    return Object.keys(val).map(token => parseInt(String(token).replace(/[^\d]/g, ''), 10)).filter(n => !isNaN(n) && n >= 1 && n <= maxLimit);
  }
  return [];
}

function safeJsonParse(key, fallback) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
}

function getFirstValidString(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  }
  return '';
}

// 🔒 KIZÁRÓLAG AZ AKTÍV FOLYAMATBAN LÉVŐ CSERÉKBŐL SZÁMOLT LAKAT-SZÁMLÁLÓ
function getActiveLockedCounts(albumId = currentAlbumId) {
  const counts = {};
  (myProfile.activeTrades || []).forEach(t => {
    if (t.status === 'pending' && (t.albumId || 'lidl-lutra-2026') === albumId) {
      (t.givingItems || []).forEach(num => {
        counts[num] = (counts[num] || 0) + 1;
      });
    }
  });
  return counts;
}

// 108 MATRICÁS LIDL LUTRA FEJEZETEK (FIRESTORE-BA TÖLTÉSRE KÉSZEN)
const FEJEZETEK = [
  { id: "bevezeto", cim: "1. oldal — Bevezető", elemek: [ { type: "single", num: 1, name: "WWF Magyarország logó", orient: "álló" } ] },
  { id: "elettel_teli_bolygo", cim: "2–3. oldal — Élettel teli bolygó", elemek: [
      { type: "single", num: 2, name: "Kék bálna", orient: "fekvő" }, { type: "single", num: 3, name: "Jegesmedve", orient: "fekvő" },
      { type: "single", num: 4, name: "Hópárduc", orient: "fekvő" }, { type: "single", num: 5, name: "Óriáspanda", orient: "fekvő" },
      { type: "single", num: 6, name: "Kondorkeselyű", orient: "fekvő" }, { type: "single", num: 7, name: "Bogáncslepke", orient: "fekvő" },
      { type: "single", num: 8, name: "Atlanti tokhal", orient: "fekvő" }, { type: "single", num: 9, name: "Vidra", orient: "fekvő" }
  ]},
  { id: "europa", cim: "4–5. oldal — Európa", elemek: [
      { type: "single", num: 10, name: "Vöröshasú unka", orient: "fekvő" }, { type: "single", num: 11, name: "Barna medve", orient: "fekvő" },
      { type: "single", num: 12, name: "Eurázsiai hiúz", orient: "fekvő" }, { type: "single", num: 13, name: "Szürke farkas", orient: "fekvő" },
      { type: "single", num: 14, name: "Kacsafarkú szender", orient: "fekvő" }, { type: "single", num: 15, name: "Törpekuvik", orient: "fekvő" }
  ]},
  { id: "afrika", cim: "6–7. oldal — Afrika", elemek: [
      { type: "single", num: 16, name: "Erdei elefánt", orient: "fekvő" }, { type: "single", num: 17, name: "Gepárd", orient: "fekvő" },
      { type: "single", num: 18, name: "Fehérhátú keselyű", orient: "fekvő" }, { type: "single", num: 19, name: "Közönséges cserepesteknős", orient: "fekvő" },
      { type: "single", num: 20, name: "Nyugati gorilla", orient: "fekvő" }, { type: "single", num: 21, name: "Szélesszájú orrszarvú", orient: "fekvő" }
  ]},
  { id: "eszak_amerika", cim: "8–9. oldal — Észak-Amerika", elemek: [
      { type: "single", num: 22, name: "Amerikai bölény", orient: "fekvő" }, { type: "single", num: 23, name: "Fehérfejű rétisas", orient: "fekvő" },
      { type: "single", num: 24, name: "Kaliforniai disznódelfin", orient: "fekvő" }, { type: "single", num: 25, name: "Vörhenyes kolibri", orient: "fekvő" },
      { type: "single", num: 26, name: "Királylazac", orient: "fekvő" }, { type: "single", num: 27, name: "Pompás királylepke", orient: "fekvő" }
  ]},
  { id: "del_amerika", cim: "10–11. oldal — Dél-Amerika", elemek: [
      { type: "single", num: 28, name: "Jaguár", orient: "fekvő" }, { type: "single", num: 29, name: "Kutyafejű boa", orient: "fekvő" },
      { type: "single", num: 30, name: "Arany oroszlánmajom", orient: "fekvő" }, { type: "single", num: 31, name: "Nagy jácintara", orient: "fekvő" },
      { type: "single", num: 32, name: "Sakáre-kajmán", orient: "fekvő" }, { type: "single", num: 33, name: "Amazonasi folyamidelfin", orient: "fekvő" }
  ]},
  { id: "azsia", cim: "12–13. oldal — Ázsia", elemek: [
      { type: "single", num: 34, name: "Mongol szajga", orient: "fekvő" }, { type: "combo", nums: [35, 36], name: "Tigris", orient: "panoráma" },
      { type: "single", num: 37, name: "Borneói orangután", orient: "álló" }, { type: "single", num: 38, name: "Mandzsu daru", orient: "álló" },
      { type: "single", num: 39, name: "Komodói sárkány", orient: "fekvő" }, { type: "single", num: 40, name: "Aranyarcú gibbon", orient: "fekvő" }
  ]},
  { id: "ausztralia", cim: "14–15. oldal — Ausztrália és Óceánia", elemek: [
      { type: "single", num: 41, name: "Keleti szürke óriáskenguru", orient: "fekvő" }, { type: "single", num: 42, name: "Tasman vombat", orient: "fekvő" },
      { type: "single", num: 43, name: "Koala", orient: "fekvő" }, { type: "single", num: 44, name: "Kakapó", orient: "fekvő" },
      { type: "single", num: 45, name: "Kacsacsőrű emlős", orient: "fekvő" }, { type: "single", num: 46, name: "Barna kivi", orient: "fekvő" }
  ]},
  { id: "antarktisz", cim: "16–17. oldal — Antarktisz", elemek: [
      { type: "single", num: 47, name: "Leopárdfóka", orient: "fekvő" }, { type: "single", num: 48, name: "Weddell-fóka", orient: "fekvő" },
      { type: "single", num: 49, name: "Császárpingvin", orient: "álló" }, { type: "combo", nums: [50, 51], name: "Adélie-pingvin", orient: "panoráma" },
      { type: "single", num: 52, name: "Galambhojsza", orient: "álló" }, { type: "single", num: 53, name: "Antarktiszi krill", orient: "fekvő" }
  ]},
  { id: "tengerek", cim: "18–19. oldal — Tengerek és óceánok", elemek: [
      { type: "single", num: 54, name: "Hosszúszárnyú bálna", orient: "fekvő" }, { type: "combo", nums: [55, 56], name: "Kardszárnyú delfin", orient: "panoráma" },
      { type: "single", num: 57, name: "Óriáscápa", orient: "fekvő" }, { type: "single", num: 58, name: "Kúpos fóka", orient: "fekvő" },
      { type: "single", num: 59, name: "Parti lile", orient: "fekvő" }, { type: "single", num: 60, name: "Barna delfin", orient: "fekvő" }
  ]},
  { id: "kihalt_allatok", cim: "20–21. oldal — Kihalt állatok", elemek: [
      { type: "single", num: 61, name: "Dodó", orient: "álló" }, { type: "single", num: 62, name: "Vékonycsőrű póling", orient: "álló" },
      { type: "single", num: 63, name: "Erszényesfarkas", orient: "fekvő" }, { type: "single", num: 64, name: "Tarpán", orient: "fekvő" },
      { type: "single", num: 65, name: "Vándorgalamb", orient: "fekvő" }, { type: "single", num: 66, name: "Őstulok", orient: "fekvő" },
      { type: "single", num: 67, name: "Elefántmadár", orient: "fekvő" }, { type: "single", num: 68, name: "Korallszirti patkány", orient: "fekvő" }
  ]},
  { id: "veszelyeztetett", cim: "22–23. oldal — Veszélyeztetett fajok", elemek: [
      { type: "single", num: 69, name: "Jávai orrszarvú", orient: "fekvő" }, { type: "single", num: 70, name: "Mezei hörcsög", orient: "fekvő" },
      { type: "single", num: 71, name: "Röviduszonyú makócápa", orient: "fekvő" }, { type: "single", num: 72, name: "Európai angolna", orient: "fekvő" },
      { type: "single", num: 73, name: "Spix-ara", orient: "fekvő" }, { type: "single", num: 74, name: "Vastagfarkú oposszum", orient: "fekvő" }
  ]},
  { id: "megmentett", cim: "24–25. oldal — Megmentett állatok", elemek: [
      { type: "single", num: 75, name: "Arab bejza", orient: "fekvő" }, { type: "single", num: 76, name: "Fehérfarkú gnú", orient: "fekvő" },
      { type: "single", num: 77, name: "Európai bölény", orient: "fekvő" }, { type: "single", num: 78, name: "Nagy szikibagoly", orient: "fekvő" },
      { type: "single", num: 79, name: "Vörös kánya", orient: "fekvő" }, { type: "single", num: 80, name: "Mallorcai béka", orient: "fekvő" }
  ]},
  { id: "fenyegetes", cim: "26–27. oldal — Mi fenyegeti a természetet?", elemek: [
      { type: "single", num: 81, name: "Élőhelyek elvesztése", orient: "fekvő" }, { type: "single", num: 82, name: "Élelmiszeripar", orient: "fekvő" },
      { type: "single", num: 83, name: "Szennyezés", orient: "fekvő" }, { type: "combo", nums: [84, 85], name: "Túlzott kizsákmányolás", orient: "panoráma" },
      { type: "single", num: 86, name: "Túlhalászás", orient: "fekvő" }, { type: "single", num: 87, name: "Műanyaghulladék", orient: "fekvő" },
      { type: "single", num: 88, name: "Folyószabályozás", orient: "fekvő" }, { type: "single", num: 89, name: "Erőforrások", orient: "fekvő" },
      { type: "single", num: 90, name: "Éghajlatváltozás", orient: "fekvő" }, { type: "single", num: 91, name: "Inváziós fajok", orient: "fekvő" }
  ]},
  { id: "megoldasok", cim: "28–29. oldal — Bolygóbarát megoldások", elemek: [
      { type: "single", num: 92, name: "Védett területek", orient: "fekvő" }, { type: "single", num: 93, name: "Élelmiszerrendszer", orient: "fekvő" },
      { type: "single", num: 94, name: "Megújuló energia", orient: "fekvő" }, { type: "single", num: 95, name: "Természetalapú megoldások", orient: "fekvő" },
      { type: "single", num: 96, name: "Közösségi bevonás", orient: "fekvő" }
  ]},
  { id: "wwf", cim: "30–31. oldal — WWF Magyarország", elemek: [
      { type: "single", num: 97, name: "WWF hazai programok", orient: "fekvő" }, { type: "single", num: 98, name: "WWF erdőprogram", orient: "fekvő" },
      { type: "single", num: 99, name: "Vizesélőhelyek", orient: "fekvő" }, { type: "single", num: 100, name: "Klímaprogramok", orient: "fekvő" },
      { type: "single", num: 101, name: "Környezeti nevelés", orient: "fekvő" }, { type: "single", num: 102, name: "Jelképes örökbefogadás", orient: "álló" }
  ]},
  { id: "szuperhos", cim: "32. oldal — Legyél bolygóvédő szuperhős!", elemek: [
      { type: "single", num: 103, name: "Természetmegfigyelés", orient: "álló" }, { type: "single", num: 104, name: "Kihívások otthon", orient: "fekvő" },
      { type: "single", num: 105, name: "Vadon élő állatok", orient: "fekvő" }
  ]},
  { id: "lidl_zold", cim: "33. oldal — Zöldebb jövő a Lidlnél", elemek: [
      { type: "single", num: 106, name: "Biotermékek", orient: "fekvő" }, { type: "single", num: 107, name: "Vadvirágos rétek", orient: "fekvő" },
      { type: "single", num: 108, name: "Planetary Health Diet", orient: "álló" }
  ] }
];

const STICKER_NAMES = {};
const STICKER_ORIENTS = {};
FEJEZETEK.forEach(f => {
  f.elemek.forEach(el => {
    if (el.type === 'combo') {
      STICKER_NAMES[el.nums[0]] = `${el.name} (Bal)`; STICKER_NAMES[el.nums[1]] = `${el.name} (Jobb)`;
      STICKER_ORIENTS[el.nums[0]] = "panoráma"; STICKER_ORIENTS[el.nums[1]] = "panoráma";
    } else {
      STICKER_NAMES[el.num] = el.name; STICKER_ORIENTS[el.num] = el.orient || "fekvő";
    }
  });
});
// =========================================================================
// 2/4. RÉSZ: PROFILMODELL, 4-ÁLLAPOTÚ KATTINTÁSI CIKLUS,
// RÁCSRENDERELŐ, DINAMIKUS LAKATOK ÉS TÖMEGES BEVITEL
// =========================================================================

function extractUserData(data, docId, targetAlbumId = currentAlbumId) {
  if (!data) return null;

  const nev = getFirstValidString(data.nev, data.nickname, data.name, data.displayName) || 'Névtelen gyűjtő';
  const telepules = getFirstValidString(data.telepules, data.city, data.varos);
  const email = getFirstValidString(data.notifyEmail, data.email, data.mail);
  const locations = Array.isArray(data.locations) ? data.locations : (telepules ? [{ city: telepules, districts: [] }] : []);
  const geo = (data.geo && typeof data.geo.lat === 'number') ? data.geo : null;

  let rawVan = [];
  let rawKell = [];
  let rawFoglalva = [];
  let vanCounts = {};
  let foglalvaCounts = {};

  if (data.collections && data.collections[targetAlbumId]) {
    const col = data.collections[targetAlbumId];
    rawVan = col.van || [];
    rawKell = col.kell || [];
    rawFoglalva = col.foglalva || [];
    vanCounts = col.vanCounts || {};
    foglalvaCounts = col.foglalvaCounts || {};
  } else if (targetAlbumId === 'lidl-lutra-2026') {
    rawVan = data.van || data.duplicates || data.duplak || [];
    rawKell = data.kell || data.missing || data.hianyzo || [];
    rawFoglalva = data.foglalva || data.reserved || [];
    vanCounts = data.vanCounts || {};
    foglalvaCounts = data.foglalvaCounts || {};
  }

  const van = ensureArray(rawVan).sort((a, b) => a - b);
  const kell = ensureArray(rawKell).sort((a, b) => a - b);
  const foglalva = ensureArray(rawFoglalva).sort((a, b) => a - b);

  const favorites = ensureArray(data.favorites || []);
  const isGiftOffering = data.isGiftOffering === true || data.isGift === true;
  const showEmailToUsers = data.showEmailToUsers === true;
  const emailNotifications = data.emailNotifications !== false;
  const allowInspect = data.allowInspect !== false;
  const gdprAccepted = data.gdprAccepted !== false;
  const trustScore = parseFloat(data.trustScore || '0');
  const ratingsCount = parseInt(data.ratingsCount || '0', 10);
  const recentReviews = Array.isArray(data.recentReviews) ? data.recentReviews : [];

  return {
    id: docId,
    nev,
    telepules,
    locations,
    geo,
    email,
    van,
    kell,
    foglalva,
    favorites,
    vanCounts,
    foglalvaCounts,
    isGiftOffering,
    showEmailToUsers,
    emailNotifications,
    allowInspect,
    gdprAccepted,
    trustScore,
    ratingsCount,
    recentReviews
  };
}

let myProfile = {
  nev: "Vendég gyűjtő",
  telepules: "",
  locations: [{ city: "", districts: [] }],
  geo: myGpsCoords,
  email: "",
  isGiftOffering: false,
  showEmailToUsers: false,
  emailNotifications: true,
  allowInspect: true,
  gdprAccepted: true,
  trustScore: 0,
  ratingsCount: 0,
  privateNote: localStorage.getItem(`private_note_${currentAlbumId}`) || (currentAlbumId === 'lidl-lutra-2026' ? (localStorage.getItem('lutra_private_note') || '') : ''),
  favorites: ensureArray(safeJsonParse('lutra_favorites', [9, 4, 35])),
  van: ensureArray(safeJsonParse(`lutra_van_${currentAlbumId}`, [])).sort((a, b) => a - b),
  vanCounts: safeJsonParse(`lutra_van_counts_${currentAlbumId}`, {}),
  kell: ensureArray(safeJsonParse(`lutra_kell_${currentAlbumId}`, [])).sort((a, b) => a - b),
  foglalva: ensureArray(safeJsonParse(`lutra_foglalva_${currentAlbumId}`, [])).sort((a, b) => a - b),
  foglalvaCounts: safeJsonParse(`lutra_foglalva_counts_${currentAlbumId}`, {}),
  activeTrades: safeJsonParse(`lutra_active_trades_${currentAlbumId}`, [])
};

let allUsersData = [];
let myIncomingMessages = [];
let myOutgoingMessages = [];
let radarReports = [];
let meetupEvents = [];
let activeAnnouncements = [];
let albumSuggestions = [];
let selectedTradePlanUids = new Set();
let tradePlanManualOverrides = {};
let previousIncomingCount = null;
let previousRadarCount = null;
let radarAttachedBase64 = '';
let meetupAttachedBase64 = '';
let showAllHeatmapCities = false;

let activeInboxTab = 'inbox';
let msgAlbumFilter = 'all';
let currentFilter = 'all';
let matchFilter = 'all';
let currentChapterIndex = 1;
let currentUser = null;
let deferredPrompt = null;

let myDocUnsubscribe = null;
let allUsersUnsubscribe = null;
let messagesUnsubscribe = null;
let radarUnsubscribe = null;
let meetupsUnsubscribe = null;
let announcementsUnsubscribe = null;
let albumsUnsubscribe = null;
let suggestionsUnsubscribe = null;
let db = null;
let auth = null;

let activeContactTarget = {
  uid: '',
  nev: '',
  telepules: '',
  email: '',
  showEmail: false,
  subject: ''
};

function initFavoriteSelects() {
  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();
  const favContainer = document.getElementById('prof-favorites-container');

  if (favContainer) {
    favContainer.style.display = (activeAlbum.hasFavorites !== false) ? 'block' : 'none';
  }

  const titleEl = document.getElementById('prof-favorites-title');
  if (titleEl) {
    titleEl.innerHTML = currentAlbumId === 'lidl-lutra-2026'
      ? `Top 3 Kedvenc Állatod / Matricád <strong style="color:var(--amber);">* (Kötelező)</strong>`
      : `Top 3 Kedvenc Tételed (${escapeHtml(activeAlbum.title)}) <strong style="color:var(--amber);">* (Kötelező)</strong>`;
  }

  ['prof-fav-1', 'prof-fav-2', 'prof-fav-3'].forEach((id, idx) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    
    sel.innerHTML = '<option value="">-- Válassz egyet --</option>';
    for (let i = 1; i <= totalSize; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = getItemFullName(i, currentAlbumId);
      sel.appendChild(opt);
    }
    const currentFav = myProfile.favorites ? myProfile.favorites[idx] : null;
    if (currentFav && currentFav <= totalSize) sel.value = currentFav;

    sel.onchange = () => {
      const val = parseInt(sel.value, 10);
      if (!myProfile.favorites) myProfile.favorites = [];
      myProfile.favorites[idx] = isNaN(val) ? 0 : val;
      localStorage.setItem(`lutra_favorites_${currentAlbumId}`, JSON.stringify(myProfile.favorites));
      if (currentAlbumId === 'lidl-lutra-2026') localStorage.setItem('lutra_favorites', JSON.stringify(myProfile.favorites));
      checkMandatoryProfile();
    };
  });
}

// SOCIAL PROOF MUTATÓK FRISSÍTÉSE (809+ GYŰJTŐ, 290+ SIKERES CSERE)
function updateHubSocialProofMetrics() {
  const collectorsEl = document.getElementById('sp-collectors-count');
  const trackedEl = document.getElementById('sp-tracked-items-count');
  const duplicatesEl = document.getElementById('sp-duplicates-count');
  const tradesEl = document.getElementById('sp-completed-trades-count');

  if (!collectorsEl) return;

  const totalCollectors = Math.max(809, allUsersData.length);
  let totalTracked = 0;
  let totalDuplicates = 0;

  allUsersData.forEach(u => {
    totalTracked += ensureArray(u.kell).length;
    ensureArray(u.van).forEach(n => {
      const q = (u.vanCounts && u.vanCounts[n]) ? u.vanCounts[n] : 1;
      totalDuplicates += q;
      totalTracked += q;
    });
  });

  collectorsEl.textContent = `${totalCollectors}+`;
  if (trackedEl) trackedEl.textContent = totalTracked > 0 ? `${totalTracked.toLocaleString('hu-HU')}` : '135 000+';
  if (duplicatesEl) duplicatesEl.textContent = totalDuplicates > 0 ? `${totalDuplicates.toLocaleString('hu-HU')}` : '68 000';
  if (tradesEl) tradesEl.textContent = `${Math.max(290, Math.round(totalCollectors * 0.36))}+`;
}

function renderHub() {
  const container = document.getElementById('hub-albums-grid');
  const toggleBtn = document.getElementById('btn-toggle-all-hub-albums');
  const countSpan = document.getElementById('hub-total-albums-count');
  const searchInput = document.getElementById('hub-search-input');
  const query = (searchInput?.value || '').toLowerCase().trim();

  if (!container) return;

  updateHubSocialProofMetrics();

  const allFilteredList = Object.values(ALBUMS_REGISTRY).filter(album => {
    if (query) {
      const matchTitle = (album.title || '').toLowerCase().includes(query);
      const matchPub = (album.publisher || '').toLowerCase().includes(query);
      const matchYear = String(album.year || '').includes(query);
      if (!matchTitle && !matchPub && !matchYear) return false;
    }

    if (currentHubFilter === 'sticker') return album.type === 'sticker';
    if (currentHubFilter === 'card') return album.type === 'card';
    if (currentHubFilter === 'figure') return album.type === 'figure';
    if (currentHubFilter === 'retro') return album.year < 2018 || album.isRetro === true;
    if (currentHubFilter === 'my') {
      const myCount = ensureArray(safeJsonParse(`lutra_van_${album.id}`, [])).length;
      return myCount > 0;
    }
    return true;
  });

  if (countSpan) countSpan.textContent = allFilteredList.length;

  let displayList = allFilteredList;
  if (currentHubFilter === 'all' && !showAllHubAlbums && !query) {
    displayList = allFilteredList.slice(0, 6);
  }

  if (toggleBtn) {
    if (currentHubFilter !== 'all' || allFilteredList.length <= 6 || query) {
      toggleBtn.style.display = 'none';
    } else {
      toggleBtn.style.display = 'inline-block';
      toggleBtn.innerHTML = showAllHubAlbums 
        ? '▲ Csak a kiemeltek mutatása (6 db)' 
        : `Összes gyűjtemény listázása (${allFilteredList.length} db) ▼`;
    }
  }

  container.innerHTML = displayList.map(album => {
    const isFeatured = album.featured === true || album.id === 'lidl-lutra-2026';
    const isRetro = album.year < 2018 || album.isRetro === true;
    const albumVan = ensureArray(safeJsonParse(`lutra_van_${album.id}`, album.id === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : []));
    const collectedCount = albumVan.length;
    const pct = Math.min(100, Math.round((collectedCount / album.totalItems) * 100));
    const cover = album.coverUrl || 'og-image.png';

    return `
      <div class="album-hub-card ${isFeatured ? 'featured-card' : ''}" data-album-id="${escapeHtml(album.id)}">
        <div>
          <img src="${cover}" class="hub-card-thumb" alt="${escapeHtml(album.title)}" loading="lazy">
          <div class="album-hub-header">
            <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
              <span class="album-type-badge">${escapeHtml(album.typeLabel)}</span>
              ${isRetro ? `<span class="album-type-badge badge-retro">🕹️ Retro (${album.year})</span>` : `<span style="font-size:0.75rem; color:var(--text-muted);">${album.year}</span>`}
            </div>
            <span style="font-size:0.75rem; color:var(--sand); font-weight:700;">${album.totalItems} db</span>
          </div>
          <h3 style="margin:4px 0; font-size:1.15rem; color:#FFF;">${escapeHtml(album.title)}</h3>
          <p style="font-size:0.8rem; color:var(--text-muted); margin:0 0 10px;">${escapeHtml(album.publisher)} • ${escapeHtml(album.subtitle || '')}</p>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-size:0.75rem; color:var(--sand);">
            <span>Gyűjtve: <strong>${collectedCount} / ${album.totalItems} db</strong></span>
            <strong>${pct}%</strong>
          </div>
          <div class="album-hub-progress-track">
            <div class="album-hub-progress-bar" style="width:${pct}%;"></div>
          </div>
          <div style="margin-top:12px;">
            <button class="btn btn-primary btn-sm" style="width:100%; font-size:0.82rem; padding:8px;" data-action="select-album" data-album-id="${escapeHtml(album.id)}">
              Megnyitás & Gyűjtés ➔
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('hub-search-input', 'input', () => renderHub());

safeAddListener('btn-toggle-all-hub-albums', () => {
  showAllHubAlbums = !showAllHubAlbums;
  renderHub();
});

safeAddListener('hub-albums-grid', (e) => {
  const btn = e.target.closest('[data-action="select-album"]');
  const card = e.target.closest('.album-hub-card');
  const albumId = btn?.dataset.albumId || card?.dataset.albumId;
  if (!albumId) return;

  selectAlbum(albumId);
});

safeAddListener('btn-open-suggest-album', () => document.getElementById('modal-suggest-album')?.classList.add('open'));
safeAddListener('btn-close-suggest-album', () => document.getElementById('modal-suggest-album')?.classList.remove('open'));

safeAddListener('btn-submit-suggest-album', async () => {
  const title = document.getElementById('suggest-album-title')?.value.trim();
  if (!title) return showToast("Kérlek add meg a gyűjtemény nevét!");

  try {
    if (db) {
      await db.collection("album_suggestions").add({
        title,
        submittedByUid: currentUser ? currentUser.uid : 'vendeg',
        submittedByName: myProfile.nev || 'Gyűjtő',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: "pending"
      });
    }
    document.getElementById('suggest-album-title').value = '';
    document.getElementById('modal-suggest-album')?.classList.remove('open');
    showToast("Köszönjük! A javaslatodat elküldtük az adminnak.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  }
});

function updateRadarStoreDatalist() {
  const activeAlbum = getActiveAlbum();
  const datalist = document.getElementById('lidl-all-stores');
  const inputEl = document.getElementById('radar-input-store');
  if (!datalist || !inputEl) return;

  const chain = activeAlbum.radarType || (activeAlbum.hasRadar ? 'lidl' : 'none');
  datalist.innerHTML = '';

  if (chain === 'retail_general') {
    inputEl.placeholder = "Írd be a várost és a boltot (pl. Nyugati Relay vagy Árkád Müller)...";
  } else if (STORE_DATABASES[chain]) {
    const chainName = chain === 'lidl' ? 'Lidl' : (activeAlbum.publisher || chain);
    inputEl.placeholder = `Válassz a(z) ${chainName} áruházak listájából vagy írd be a várost...`;
    STORE_DATABASES[chain].forEach(store => {
      const opt = document.createElement('option');
      opt.value = store;
      datalist.appendChild(opt);
    });
  } else {
    inputEl.placeholder = "Kezdd el gépelni a boltot vagy a várost...";
  }
}

function selectAlbum(albumId) {
  if (!ALBUMS_REGISTRY[albumId]) return;
  currentAlbumId = albumId;
  localStorage.setItem('lutra_active_album', albumId);
  const activeAlbum = getActiveAlbum();

  const albumBar = document.getElementById('active-album-bar');
  const titleEl = document.getElementById('active-album-title');
  const thumbEl = document.getElementById('active-album-thumb');
  const noteTitleEl = document.getElementById('prof-note-album-title');
  const statAlbumName = document.getElementById('stats-active-album-name');
  const sizeSpan = document.getElementById('count-total-size');

  if (albumBar) albumBar.style.display = 'flex';
  if (titleEl) titleEl.textContent = `${activeAlbum.title} (${activeAlbum.year})`;
  if (thumbEl) thumbEl.src = activeAlbum.coverUrl || 'og-image.png';
  if (noteTitleEl) noteTitleEl.textContent = activeAlbum.title;
  if (statAlbumName) statAlbumName.textContent = activeAlbum.title;
  if (sizeSpan) sizeSpan.textContent = activeAlbum.totalItems;

  const primaryNav = document.getElementById('main-primary-nav');
  const mobileNav = document.getElementById('mobile-subnav-bar');
  if (primaryNav) primaryNav.style.display = 'grid';
  if (mobileNav) mobileNav.style.display = 'block';

  updateRadarStoreDatalist();

  const albumModeToggle = document.querySelector('.view-mode-toggle');
  if (albumModeToggle) {
    albumModeToggle.style.display = (activeAlbum.type === 'sticker' && activeAlbum.hasChapters) ? 'flex' : 'none';
  }

  const certPromoCard = document.getElementById('cert-promo-card');
  if (certPromoCard) {
    certPromoCard.style.display = albumId === 'lidl-lutra-2026' ? 'block' : 'none';
  }

  const diffSec = document.getElementById('stat-sec-diff');
  const diffJump = document.getElementById('btn-jump-diff');
  if (diffSec) diffSec.style.display = (activeAlbum.type === 'sticker' && activeAlbum.hasChapters) ? 'block' : 'none';
  if (diffJump) diffJump.style.display = (activeAlbum.type === 'sticker' && activeAlbum.hasChapters) ? 'inline-block' : 'none';

  const gridEl = document.getElementById('matrica-grid');
  if (gridEl) {
    gridEl.classList.toggle('matrica-grid-figures', activeAlbum.type === 'figure');
  }

  loadAlbumState(albumId);
  initFavoriteSelects();
  switchView('matricaim');
  showToast(`Aktív gyűjtemény: ${activeAlbum.title}`);
}

safeAddListener('btn-switch-album', () => {
  const albumBar = document.getElementById('active-album-bar');
  const primaryNav = document.getElementById('main-primary-nav');
  const mobileNav = document.getElementById('mobile-subnav-bar');

  if (albumBar) albumBar.style.display = 'none';
  if (primaryNav) primaryNav.style.display = 'none';
  if (mobileNav) mobileNav.style.display = 'none';

  switchView('hub');
});

function loadAlbumState(albumId) {
  myProfile.van = ensureArray(safeJsonParse(`lutra_van_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van', []) : [])).sort((a, b) => a - b);
  myProfile.vanCounts = safeJsonParse(`lutra_van_counts_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_van_counts', {}) : {});
  myProfile.kell = ensureArray(safeJsonParse(`lutra_kell_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_kell', []) : [])).sort((a, b) => a - b);
  myProfile.foglalva = ensureArray(safeJsonParse(`lutra_foglalva_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_foglalva', []) : [])).sort((a, b) => a - b);
  myProfile.foglalvaCounts = safeJsonParse(`lutra_foglalva_counts_${albumId}`, albumId === 'lidl-lutra-2026' ? safeJsonParse('lutra_foglalva_counts', {}) : {});
  myProfile.activeTrades = safeJsonParse(`lutra_active_trades_${albumId}`, []);
  
  let savedNote = localStorage.getItem(`private_note_${albumId}`);
  if (!savedNote && albumId === 'lidl-lutra-2026') {
    savedNote = localStorage.getItem('lutra_private_note') || '';
  }
  myProfile.privateNote = (savedNote || '').slice(0, 250);

  const noteInput = document.getElementById('prof-private-note');
  if (noteInput) {
    noteInput.value = myProfile.privateNote;
    const countEl = document.getElementById('note-char-count');
    if (countEl) countEl.textContent = `${myProfile.privateNote.length}/250`;
  }

  renderGrid();
  renderActiveTradesPanel();
  if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderAlbumChapter();
  renderMatches();
}

document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    const clickedFilter = btn.dataset.hubFilter;
    if (btn.classList.contains('active') && clickedFilter !== 'all') {
      document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(b => b.classList.remove('active'));
      document.querySelector('.filter-btn[data-hub-filter="all"]')?.classList.add('active');
      currentHubFilter = 'all';
    } else {
      document.querySelectorAll('.filter-btn[data-hub-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentHubFilter = clickedFilter;
    }
    renderHub();
  });
});

// =========================================================================
// RÁCS RENDERELÉS: SZABAD DUPLA + 🔒 DINAMIKUS LAKAT (CSAK VALÓDI CSERÉNÉL!)
// =========================================================================
function renderGrid() {
  const grid = document.getElementById('matrica-grid');
  if (!grid) return;

  const activeAlbum = getActiveAlbum();
  const totalSize = getActiveAlbumSize();
  const isFigure = activeAlbum.type === 'figure';
  let html = '';
  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));

  // Dinamikusan kizárólag a pending státuszú aktív cserékből olvasunk lakatot!
  const activeLocks = getActiveLockedCounts(currentAlbumId);

  for (let i = 1; i <= totalSize; i++) {
    const isVan = vanSet.has(i);
    const isKell = kellSet.has(i);
    const isFog = foglalvaSet.has(i);

    if (currentFilter === 'van' && !isVan) continue;
    if (currentFilter === 'kell' && !isKell) continue;
    if (currentFilter === 'foglalva' && !isFog) continue;

    let cls = isVan ? 'van' : isKell ? 'kell' : isFog ? 'foglalva' : '';
    if (isFigure) cls += ' cell-figure';

    let badgesHtml = '';
    const vQty = (isVan && myProfile.vanCounts && myProfile.vanCounts[i]) ? myProfile.vanCounts[i] : 1;
    const fQty = activeLocks[i] || 0;

    // Szabad duplák száma (zöld badge a jobb felső sarokban)
    if (isVan && vQty > 1) {
      badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    }
    // Zárolt tételek száma (kék lakat badge a bal felső sarokban)
    if (isVan && fQty > 0) {
      badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    }
    // Kézzel foglaltra állított tétel (kék cella)
    if (isFog) {
      const manualFogQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[i]) ? myProfile.foglalvaCounts[i] : 1;
      if (manualFogQty > 1) {
        badgesHtml += `<span class="qty-badge foglalva">×${manualFogQty}</span>`;
      }
    }

    const itemLabel = getItemLabel(i, currentAlbumId);
    const itemFull = getItemFullName(i, currentAlbumId);

    html += `<div class="matrica-cell ${cls}" data-num="${i}" title="${escapeHtml(itemFull)}">
      ${escapeHtml(itemLabel)}
      ${badgesHtml}
    </div>`;
  }
  grid.innerHTML = html;
  updateBadgeCounts();
}

function updateBadgeCounts() {
  const cVan = document.getElementById('count-van');
  const cKell = document.getElementById('count-kell');
  const cFoglalva = document.getElementById('count-foglalva');
  if (cVan) cVan.textContent = myProfile.van.length;
  if (cKell) cKell.textContent = myProfile.kell.length;
  if (cFoglalva) cFoglalva.textContent = myProfile.foglalva.length;
}

function initAlbumSelect() {
  const sel = document.getElementById('album-chapter-select');
  if (!sel) return;
  const chapters = getActiveChapters();
  sel.innerHTML = '';
  chapters.forEach((f, idx) => {
    const opt = document.createElement('option');
    opt.value = idx;
    opt.textContent = f.cim;
    sel.appendChild(opt);
  });
  sel.onchange = (e) => {
    currentChapterIndex = parseInt(e.target.value, 10);
    renderAlbumChapter();
  };
}

function renderAlbumChapter() {
  const chapters = getActiveChapters();
  if (chapters.length === 0) return;
  initAlbumSelect();
  const container = document.getElementById('album-chapter-content');
  if (!container) return;

  if (currentChapterIndex >= chapters.length) currentChapterIndex = 0;
  const chapter = chapters[currentChapterIndex];
  if (!chapter) return;

  const sel = document.getElementById('album-chapter-select');
  if (sel) sel.value = currentChapterIndex;

  const btnPrev = document.getElementById('btn-album-prev');
  const btnNext = document.getElementById('btn-album-next');
  if (btnPrev) btnPrev.disabled = currentChapterIndex === 0;
  if (btnNext) btnNext.disabled = currentChapterIndex === chapters.length - 1;

  const vanSet = new Set(ensureArray(myProfile.van));
  const kellSet = new Set(ensureArray(myProfile.kell));
  const foglalvaSet = new Set(ensureArray(myProfile.foglalva));

  let totalInChapter = 0;
  let markedInChapter = 0;

  chapter.elemek.forEach(el => {
    const nums = el.type === 'combo' ? el.nums : [el.num];
    totalInChapter += nums.length;
    nums.forEach(n => {
      if (vanSet.has(n) || kellSet.has(n) || foglalvaSet.has(n)) markedInChapter++;
    });
  });

  const isLutra = currentAlbumId === 'lidl-lutra-2026';

  container.innerHTML = `
    <div class="page-header">
      <h3 class="page-title">${escapeHtml(chapter.cim)}</h3>
      <span class="page-progress">${markedInChapter} / ${totalInChapter} bejelölve</span>
    </div>
    <div class="slots-grid">
      ${chapter.elemek.map(el => {
        if (el.type === 'combo') {
          const [n1, n2] = el.nums;
          const isVan1 = vanSet.has(n1), isKell1 = kellSet.has(n1), isFog1 = foglalvaSet.has(n1);
          const isVan2 = vanSet.has(n2), isKell2 = kellSet.has(n2), isFog2 = foglalvaSet.has(n2);
          const q1 = isVan1 ? (myProfile.vanCounts[n1] || 1) : (myProfile.foglalvaCounts?.[n1] || 1);
          const q2 = isVan2 ? (myProfile.vanCounts[n2] || 1) : (myProfile.foglalvaCounts?.[n2] || 1);
          return `
            <div class="combo-wrapper">
              <div class="combo-title"><span>${escapeHtml(el.name)}</span></div>
              <div class="combo-halves">
                <div class="combo-half ${isVan1 ? 'van' : isKell1 ? 'kell' : isFog1 ? 'foglalva' : ''}" data-num="${n1}">
                  ${((isVan1 || isFog1) && q1 > 1) ? `<span class="qty-badge ${isFog1 ? 'foglalva' : ''}">×${q1}</span>` : ''}
                  <span class="sticker-num">${escapeHtml(getItemLabel(n1))}</span>
                  <span class="sticker-tag">${isVan1 ? 'Dupla' : isKell1 ? 'Kell' : isFog1 ? 'Foglalt' : 'Bal fél'}</span>
                </div>
                <div class="combo-half ${isVan2 ? 'van' : isKell2 ? 'kell' : isFog2 ? 'foglalva' : ''}" data-num="${n2}">
                  ${((isVan2 || isFog2) && q2 > 1) ? `<span class="qty-badge ${isFog2 ? 'foglalva' : ''}">×${q2}</span>` : ''}
                  <span class="sticker-num">${escapeHtml(getItemLabel(n2))}</span>
                  <span class="sticker-tag">${isVan2 ? 'Dupla' : isKell2 ? 'Kell' : isFog2 ? 'Foglalt' : 'Jobb fél'}</span>
                </div>
              </div>
            </div>
          `;
        } else {
          const isVan = vanSet.has(el.num);
          const isKell = kellSet.has(el.num);
          const isFog = foglalvaSet.has(el.num);
          const q = isVan ? (myProfile.vanCounts[el.num] || 1) : (myProfile.foglalvaCounts?.[el.num] || 1);
          let cls = isVan ? 'van' : isKell ? 'kell' : isFog ? 'foglalva' : '';
          
          let orientClass = isLutra 
            ? (el.orient === 'álló' ? 'orient-allo' : 'orient-fekvo')
            : 'orient-negyzet';

          return `
            <div class="slot ${orientClass} ${cls}" data-num="${el.num}">
              ${((isVan || isFog) && q > 1) ? `<span class="qty-badge ${isFog ? 'foglalva' : ''}">×${q}</span>` : ''}
              <span class="sticker-num">${escapeHtml(getItemLabel(el.num))}</span>
              <span class="sticker-name">${escapeHtml(el.name)}</span>
              <span class="sticker-tag">${isVan ? 'Dupla' : isKell ? 'Hiányzik' : isFog ? 'Foglalt' : 'Üres'}</span>
            </div>
          `;
        }
      }).join('')}
    </div>
  `;
}

let activePopoverNum = null;
const popover = document.getElementById('qty-popover');

// =========================================================================
// ⚡ 0 MS-OS 4-ÁLLAPOTÚ KATTINTÁSI CIKLUS
// =========================================================================
function toggleStickerState(num) {
  hideQtyPopover();

  const isVan = myProfile.van.includes(num);
  const isKell = myProfile.kell.includes(num);
  const isFog = myProfile.foglalva.includes(num);

  let newState = '';

  // 1. Alapból ➔ DUPLA (🟢 Zöld)
  if (!isVan && !isKell && !isFog) {
    myProfile.van.push(num);
    myProfile.vanCounts[num] = 1;
    newState = 'van';
  }
  // 2. Duplából ➔ HIÁNYZIK (🟤 Barna)
  else if (isVan) {
    const idx = myProfile.van.indexOf(num);
    if (idx > -1) myProfile.van.splice(idx, 1);
    delete myProfile.vanCounts[num];
    myProfile.kell.push(num);
    newState = 'kell';
  }
  // 3. Hiányzóból ➔ FOGLALT (🔵 Kék)
  else if (isKell) {
    const idx = myProfile.kell.indexOf(num);
    if (idx > -1) myProfile.kell.splice(idx, 1);
    myProfile.foglalva.push(num);
    if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
    myProfile.foglalvaCounts[num] = 1;
    newState = 'foglalva';
  }
  // 4. Foglaltból ➔ ALAP / ÜRES (Megvan)
  else if (isFog) {
    const idx = myProfile.foglalva.indexOf(num);
    if (idx > -1) myProfile.foglalva.splice(idx, 1);
    if (myProfile.foglalvaCounts) delete myProfile.foglalvaCounts[num];
    newState = '';
  }

  // 0 ms azonnali helyi DOM manipuláció
  updateSingleCellDOM(num, newState);
  updateBadgeCounts();
  saveMyStateFast();
}

function updateSingleCellDOM(num, state) {
  const cell = document.querySelector(`.matrica-cell[data-num="${num}"]`);
  if (cell) {
    cell.classList.remove('van', 'kell', 'foglalva');
    if (state) cell.classList.add(state);
    
    const badges = cell.querySelectorAll('.qty-badge');
    badges.forEach(b => b.remove());

    let badgesHtml = '';
    const vQty = (state === 'van' && myProfile.vanCounts?.[num]) ? myProfile.vanCounts[num] : 0;
    const activeLocks = getActiveLockedCounts(currentAlbumId);
    const fQty = activeLocks[num] || 0;

    if (vQty > 1) {
      badgesHtml += `<span class="qty-badge">×${vQty}</span>`;
    }
    if (fQty > 0 && state === 'van') {
      badgesHtml += `<span class="qty-badge locked-badge">🔒${fQty}</span>`;
    } else if (state === 'foglalva') {
      const manQty = (myProfile.foglalvaCounts && myProfile.foglalvaCounts[num]) ? myProfile.foglalvaCounts[num] : 1;
      if (manQty > 1) {
        badgesHtml += `<span class="qty-badge foglalva">×${manQty}</span>`;
      }
    }
    cell.insertAdjacentHTML('beforeend', badgesHtml);
  }

  const albumSlots = document.querySelectorAll(`[data-num="${num}"]`);
  albumSlots.forEach(el => {
    if (el.classList.contains('slot') || el.classList.contains('combo-half')) {
      el.classList.remove('van', 'kell', 'foglalva');
      if (state) el.classList.add(state);
      const tag = el.querySelector('.sticker-tag');
      if (tag) {
        tag.textContent = state === 'van' ? 'Dupla' : state === 'kell' ? 'Hiányzik' : state === 'foglalva' ? 'Foglalt' : 'Üres';
      }
    }
  });
}

function showQtyPopover(num, targetEl) {
  if (!popover || !targetEl) return;
  activePopoverNum = num;
  let currentQty = 1;
  if (myProfile.van.includes(num)) currentQty = myProfile.vanCounts[num] || 1;
  if (myProfile.foglalva.includes(num)) currentQty = myProfile.foglalvaCounts?.[num] || 1;

  document.querySelectorAll('.qty-pop-btn').forEach(btn => {
    const q = parseInt(btn.dataset.qty, 10);
    btn.classList.toggle('active', q === currentQty);
  });

  popover.style.display = 'flex';
  popover.style.visibility = 'hidden';
  popover.classList.add('open');

  const rect = targetEl.getBoundingClientRect();
  const popRect = popover.getBoundingClientRect();
  const viewportWidth = window.innerWidth;

  let left = rect.left + rect.width / 2;
  const halfWidth = popRect.width / 2;
  if (left - halfWidth < 10) left = halfWidth + 10;
  else if (left + halfWidth > viewportWidth - 10) left = viewportWidth - halfWidth - 10;

  let top = rect.top - 8;
  let transformY = '-100%';
  if (rect.top - popRect.height < 60) {
    top = rect.bottom + 8;
    transformY = '0%';
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.transform = `translate(-50%, ${transformY})`;
  popover.style.visibility = 'visible';
}

function hideQtyPopover() {
  if (!popover) return;
  popover.classList.remove('open');
  popover.style.display = 'none';
  activePopoverNum = null;
}

// =========================================================================
// ÉRINTÉS ÉS KATTINTÁSKEZELŐ (JOBB KLIKK / HOSSZÚ NYOMÁS = POPOVER)
// =========================================================================
function attachStickerInteraction(container) {
  if (!container) return;
  let touchStartPos = { x: 0, y: 0 };
  let isLongPressTriggered = false;
  let longPressTimer = null;

  // Jobb klikk (PC) ➔ Darabszám Popover
  container.addEventListener('contextmenu', (e) => {
    const target = e.target.closest('[data-num]');
    if (target) {
      e.preventDefault();
      showQtyPopover(parseInt(target.dataset.num, 10), target);
    }
  });

  // Hosszú nyomás (Mobil) ➔ Darabszám Popover
  container.addEventListener('touchstart', (e) => {
    const target = e.target.closest('[data-num]');
    if (!target) return;
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isLongPressTriggered = false;

    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      if ("vibrate" in navigator) navigator.vibrate(35);
      showQtyPopover(parseInt(target.dataset.num, 10), target);
    }, 450);
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    const moveX = Math.abs(e.touches[0].clientX - touchStartPos.x);
    const moveY = Math.abs(e.touches[0].clientY - touchStartPos.y);
    if (moveX > 10 || moveY > 10) {
      clearTimeout(longPressTimer);
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    clearTimeout(longPressTimer);
    if (isLongPressTriggered) {
      e.preventDefault();
      return;
    }
  });

  // Bal kattintás / Mobil gyors érintés ➔ 0 ms azonnali állapotváltás
  container.addEventListener('click', (e) => {
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      return;
    }
    const target = e.target.closest('[data-num]');
    if (target) {
      toggleStickerState(parseInt(target.dataset.num, 10));
    }
  });
}

function syncLutraDualSave(albumId) {
  if (!currentUser || !db) return;
  const isLutra = (albumId === 'lidl-lutra-2026');

  // 1. Almappa mentés
  db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(albumId).set({
    albumId: albumId,
    van: myProfile.van,
    vanCounts: myProfile.vanCounts || {},
    kell: myProfile.kell,
    foglalva: myProfile.foglalva,
    foglalvaCounts: myProfile.foglalvaCounts || {},
    localUpdatedAt: Date.now(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true }).catch(() => {});

  // 2. Fő dokumentum mentés
  const publicPayload = {
    [`collections.${albumId}`]: {
      van: myProfile.van,
      vanCounts: myProfile.vanCounts || {},
      kell: myProfile.kell,
      foglalva: myProfile.foglalva,
      foglalvaCounts: myProfile.foglalvaCounts || {},
      updatedAt: Date.now()
    },
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (isLutra) {
    publicPayload.van = myProfile.van;
    publicPayload.vanCounts = myProfile.vanCounts || {};
    publicPayload.kell = myProfile.kell;
    publicPayload.foglalva = myProfile.foglalva;
    publicPayload.foglalvaCounts = myProfile.foglalvaCounts || {};
  }

  db.collection("public_profiles").doc(currentUser.uid).set(publicPayload, { merge: true }).catch(() => {});
}

function saveMyStateFast() {
  const albumId = currentAlbumId;
  lastLocalEditTimestamp = Date.now(); // 🛡️ Rögzítjük az utolsó helyi kattintás idejét

  localStorage.setItem(`lutra_van_${albumId}`, JSON.stringify(myProfile.van));
  localStorage.setItem(`lutra_van_counts_${albumId}`, JSON.stringify(myProfile.vanCounts || {}));
  localStorage.setItem(`lutra_kell_${albumId}`, JSON.stringify(myProfile.kell));
  localStorage.setItem(`lutra_foglalva_${albumId}`, JSON.stringify(myProfile.foglalva));
  localStorage.setItem(`lutra_foglalva_counts_${albumId}`, JSON.stringify(myProfile.foglalvaCounts || {}));

  if (albumId === 'lidl-lutra-2026') {
    localStorage.setItem('lutra_van', JSON.stringify(myProfile.van));
    localStorage.setItem('lutra_van_counts', JSON.stringify(myProfile.vanCounts || {}));
    localStorage.setItem('lutra_kell', JSON.stringify(myProfile.kell));
    localStorage.setItem('lutra_foglalva', JSON.stringify(myProfile.foglalva));
    localStorage.setItem('lutra_foglalva_counts', JSON.stringify(myProfile.foglalvaCounts || {}));
  }

  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    refreshMatchesIfVisible();
    renderCompletionOdds();
    syncLutraDualSave(albumId);
  }, 450);
}

function saveMyState() {
  saveMyStateFast();
  renderGrid();
  renderHub();
}

document.querySelectorAll('.qty-pop-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!activePopoverNum) return;
    const qty = parseInt(btn.dataset.qty, 10);
    
    if (myProfile.van.includes(activePopoverNum)) {
      myProfile.vanCounts[activePopoverNum] = qty;
    } else if (myProfile.foglalva.includes(activePopoverNum)) {
      if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
      myProfile.foglalvaCounts[activePopoverNum] = qty;
    } else {
      myProfile.van.push(activePopoverNum);
      myProfile.vanCounts[activePopoverNum] = qty;
    }

    saveMyState();
    hideQtyPopover();
    showToast(`${getItemLabel(activePopoverNum)}: ${qty} db`);
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#qty-popover') && !e.target.closest('[data-num]')) hideQtyPopover();
});

safeAddListener('btn-toggle-batch', () => {
  const box = document.getElementById('batch-input-box');
  const btn = document.getElementById('btn-toggle-batch');
  if (!box) return;

  const isOpen = box.style.display === 'block';
  box.style.display = isOpen ? 'none' : 'block';
  
  if (btn) {
    btn.classList.toggle('active', !isOpen);
    btn.textContent = !isOpen ? 'Tömeges bevitel ✕' : 'Tömeges bevitel';
  }
});

safeAddListener('btn-close-batch-box', () => {
  const box = document.getElementById('batch-input-box');
  const btn = document.getElementById('btn-toggle-batch');
  if (box) box.style.display = 'none';
  if (btn) {
    btn.classList.remove('active');
    btn.textContent = 'Tömeges bevitel';
  }
});

function parseBatchInput(raw) {
  const tokens = raw.split(/[\s,;]+/);
  const parsed = {};
  const maxLimit = typeof getActiveAlbumSize === 'function' ? getActiveAlbumSize() : 2000;

  tokens.forEach(t => {
    t = t.trim();
    if (!t) return;

    const rangeMatch = t.match(/^(\d+)[\s\-—–]+(\d+)(?:[*xX](\d+))?$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      const qty = parseInt(rangeMatch[3] || '1', 10);
      const min = Math.min(start, end);
      const max = Math.max(start, end);

      for (let num = min; num <= max; num++) {
        if (num >= 1 && num <= maxLimit && qty > 0) {
          parsed[num] = (parsed[num] || 0) + qty;
        }
      }
      return;
    }

    const multMatch = t.match(/^(\d+)[*xX](\d+)$/);
    if (multMatch) {
      const num = parseInt(multMatch[1], 10);
      const qty = parseInt(multMatch[2], 10);
      if (num >= 1 && num <= maxLimit && qty > 0) parsed[num] = (parsed[num] || 0) + qty;
      return;
    }

    const num = parseInt(t.replace(/[^\d]/g, ''), 10);
    if (!isNaN(num) && num >= 1 && num <= maxLimit) {
      parsed[num] = (parsed[num] || 0) + 1;
    }
  });

  return parsed;
}

safeAddListener('btn-apply-batch-van', () => {
  const raw = document.getElementById('batch-input-text')?.value.trim() || '';
  if (!raw) return showToast("Írj be számokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.entries(parsed).forEach(([nStr, qty]) => {
    const num = parseInt(nStr, 10);
    if (!myProfile.van.includes(num)) myProfile.van.push(num);
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
    myProfile.vanCounts[num] = (myProfile.vanCounts[num] || 0) + qty;
    count += qty;
  });
  saveMyState();
  if (document.getElementById('batch-input-text')) document.getElementById('batch-input-text').value = '';
  if (document.getElementById('batch-input-box')) document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db tétel mentve a Duplákhoz.`);
});

safeAddListener('btn-apply-batch-kell', () => {
  const raw = document.getElementById('batch-input-text')?.value.trim() || '';
  if (!raw) return showToast("Írj be számokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.keys(parsed).forEach(nStr => {
    const num = parseInt(nStr, 10);
    if (!myProfile.kell.includes(num)) myProfile.kell.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
    const fIdx = myProfile.foglalva.indexOf(num);
    if (fIdx > -1) myProfile.foglalva.splice(fIdx, 1);
    count++;
  });
  saveMyState();
  if (document.getElementById('batch-input-text')) document.getElementById('batch-input-text').value = '';
  if (document.getElementById('batch-input-box')) document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db tétel mentve a Hiányzókhoz.`);
});

safeAddListener('btn-apply-batch-foglalva', () => {
  const raw = document.getElementById('batch-input-text')?.value.trim() || '';
  if (!raw) return showToast("Írj be számokat!");
  const parsed = parseBatchInput(raw);
  let count = 0;
  Object.keys(parsed).forEach(nStr => {
    const num = parseInt(nStr, 10);
    if (!myProfile.foglalva.includes(num)) myProfile.foglalva.push(num);
    const vIdx = myProfile.van.indexOf(num);
    if (vIdx > -1) { myProfile.van.splice(vIdx, 1); delete myProfile.vanCounts[num]; }
    const kIdx = myProfile.kell.indexOf(num);
    if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
    count++;
  });
  saveMyState();
  if (document.getElementById('batch-input-text')) document.getElementById('batch-input-text').value = '';
  if (document.getElementById('batch-input-box')) document.getElementById('batch-input-box').style.display = 'none';
  showToast(`${count} db tétel mentve a Foglalthoz.`);
});

safeAddListener('btn-copy-fb-post', () => {
  const activeAlbum = getActiveAlbum();
  const vanSorted = [...myProfile.van].sort((a, b) => a - b);
  const kellSorted = [...myProfile.kell].sort((a, b) => a - b);
  const vanText = vanSorted.length ? vanSorted.map(n => {
    const q = myProfile.vanCounts[n] || 1;
    const label = getItemLabel(n, currentAlbumId);
    return q > 1 ? `${label} (${q}db)` : label;
  }).join(', ') : 'Nincs duplám';
  const kellText = kellSorted.length ? kellSorted.map(n => getItemLabel(n, currentAlbumId)).join(', ') : 'Minden megvan!';
  const userCity = myProfile.telepules ? ` (${myProfile.telepules})` : '';

  const fbPost = `${activeAlbum.title} cserebere!\nGyűjtő: ${myProfile.nev}${userCity}\n\nDUPLÁK (${vanSorted.length} féle):\n${vanText}\n\nHIÁNYZIK (${kellSorted.length} db):\n${kellText}\n\nCseréljünk itt: ${window.location.href}`;
  navigator.clipboard.writeText(fbPost);
  showToast("Csereposzt kimásolva a vágólapra!");
});

safeAddListener('btn-mode-grid', () => {
  document.getElementById('btn-mode-grid')?.classList.add('active');
  document.getElementById('btn-mode-album')?.classList.remove('active');
  if (document.getElementById('grid-view-container')) document.getElementById('grid-view-container').style.display = 'block';
  if (document.getElementById('album-view-container')) document.getElementById('album-view-container').style.display = 'none';
  renderGrid();
});

safeAddListener('btn-mode-album', () => {
  document.getElementById('btn-mode-album')?.classList.add('active');
  document.getElementById('btn-mode-grid')?.classList.remove('active');
  if (document.getElementById('grid-view-container')) document.getElementById('grid-view-container').style.display = 'none';
  if (document.getElementById('album-view-container')) document.getElementById('album-view-container').style.display = 'block';
  renderAlbumChapter();
});

safeAddListener('btn-album-prev', () => {
  if (currentChapterIndex > 0) { currentChapterIndex--; renderAlbumChapter(); }
});

safeAddListener('btn-album-next', () => {
  const chapters = getActiveChapters();
  if (currentChapterIndex < chapters.length - 1) { currentChapterIndex++; renderAlbumChapter(); }
});
// =========================================================================
// 3/4. RÉSZ: ROUTER, CSERETERVEZŐ, A 4 KERESŐBLOKK (NÉV SZERINTI KERESÉSSEL),
// EGYEDI AJÁNLATOK, KAPCSOLATFELVÉTEL ÉS KÉSZLETRADAR
// =========================================================================

// AUTOMATIKUS LINKFELISMERŐ
function formatLinksWithAnchors(text) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s]|www\.[^\s<]+[^<.,:;"')\]\s])/gi;
  return escaped.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : `https://${url}`;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" style="color:var(--amber); text-decoration:underline; font-weight:600;">${url}</a>`;
  });
}

function switchCategory(catName) {
  document.querySelectorAll('.primary-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === catName));

  const subnavMatricaim = document.getElementById('subnav-matricaim');
  const subnavCserebere = document.getElementById('subnav-cserebere');
  const subnavRadar = document.getElementById('subnav-radar');
  const subnavProfil = document.getElementById('subnav-profil');

  if (subnavMatricaim) subnavMatricaim.style.display = catName === 'matricaim' ? 'flex' : 'none';
  if (subnavCserebere) subnavCserebere.style.display = catName === 'cserebere' ? 'flex' : 'none';
  if (subnavRadar) subnavRadar.style.display = catName === 'radar' ? 'flex' : 'none';
  if (subnavProfil) subnavProfil.style.display = catName === 'profil' ? 'flex' : 'none';

  if (catName === 'hub') switchView('hub');
  else if (catName === 'matricaim') switchView('matricaim');
  else if (catName === 'cserebere') switchView('cserek');
  else if (catName === 'radar') switchView('statisztika');
  else if (catName === 'profil') switchView('profil');
}

function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.add('active');

  document.querySelectorAll('.sub-tab').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));
  document.querySelectorAll('.dropdown-link').forEach(b => b.classList.toggle('active', b.dataset.view === viewName));

  let parentCat = 'matricaim';
  if (viewName === 'hub') parentCat = 'hub';
  else if (viewName === 'cserek' || viewName === 'kereso' || viewName === 'uzeneteim') parentCat = 'cserebere';
  else if (viewName === 'statisztika' || viewName === 'radar' || viewName === 'meetups') parentCat = 'radar';
  else if (viewName === 'profil' || viewName === 'admin') parentCat = 'profil';

  document.querySelectorAll('.primary-tab').forEach(b => b.classList.toggle('active', b.dataset.cat === parentCat));

  const subnavMatricaim = document.getElementById('subnav-matricaim');
  const subnavCserebere = document.getElementById('subnav-cserebere');
  const subnavRadar = document.getElementById('subnav-radar');
  const subnavProfil = document.getElementById('subnav-profil');
  if (subnavMatricaim) subnavMatricaim.style.display = parentCat === 'matricaim' ? 'flex' : 'none';
  if (subnavCserebere) subnavCserebere.style.display = parentCat === 'cserebere' ? 'flex' : 'none';
  if (subnavRadar) subnavRadar.style.display = parentCat === 'radar' ? 'flex' : 'none';
  if (subnavProfil) subnavProfil.style.display = parentCat === 'profil' ? 'flex' : 'none';

  if (viewName === 'hub') renderHub();
  if (viewName === 'cserek') renderMatches();
  if (viewName === 'kereso') renderProximityPartners();
  if (viewName === 'statisztika') {
    renderStatistics();
    renderCompletionOdds();
    renderFavoritesRanking();
    initLeafletMap();
  }
  if (viewName === 'radar') {
    renderRadarReports();
    const rBadge = document.getElementById('radar-badge');
    if (rBadge) rBadge.style.display = 'none';
  }
  if (viewName === 'meetups') {
    renderMeetups();
    const mBadge = document.getElementById('meetup-badge');
    const mBadgeM = document.getElementById('meetup-badge-m');
    if (mBadge) mBadge.style.display = 'none';
    if (mBadgeM) mBadgeM.style.display = 'none';
    updateCserebereBadge();
  }
  if (viewName === 'uzeneteim') {
    renderMessages();
    const badge = document.getElementById('unread-msg-badge');
    const badgeM = document.getElementById('unread-msg-badge-m');
    if (badge) badge.classList.add('read');
    if (badgeM) badgeM.classList.add('read');
    updateCserebereBadge();
  }
  if (viewName === 'matricaim') {
    renderGrid();
    renderActiveTradesPanel();
    if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderAlbumChapter();
  }
  if (viewName === 'admin') {
    renderAdminAnnouncements();
    renderAdminAlbumsList();
    renderAdminSuggestionsList();
  }
  if (viewName === 'profil') {
    initFavoriteSelects();
    renderProfileLocations();
  }
}

document.querySelectorAll('.primary-tab').forEach(t => {
  t.addEventListener('click', () => {
    if (t.dataset.view) switchView(t.dataset.view);
    else switchCategory(t.dataset.cat);
  });
});

document.querySelectorAll('.sub-tab').forEach(t => {
  t.addEventListener('click', () => switchView(t.dataset.view));
});

document.querySelectorAll('.dropdown-link').forEach(t => {
  t.addEventListener('click', () => switchView(t.dataset.view));
});

function updateCserebereBadge() {
  const badge = document.getElementById('cserebere-badge');
  if (!badge) return;
  const unreadMsgBadge = document.getElementById('unread-msg-badge');
  const hasUnread = unreadMsgBadge && unreadMsgBadge.style.display !== 'none' && !unreadMsgBadge.classList.contains('read');
  badge.style.display = hasUnread ? 'inline-block' : 'none';
}

// GPS ÉS TÁVOLSÁG
function getUserCoordinates(userObj) {
  if (userObj.geo && typeof userObj.geo.lat === 'number') return userObj.geo;
  const normList = extractNormalizedLocations(userObj.locations && userObj.locations.length > 0 ? userObj.locations : userObj.telepules);
  for (const loc of normList) {
    if (CITY_COORDINATES[loc.canonicalKey]) {
      return { lat: CITY_COORDINATES[loc.canonicalKey].lat, lng: CITY_COORDINATES[loc.canonicalKey].lng };
    }
  }
  return null;
}

function getUserAllCoordinates(userObj) {
  const coords = [];
  if (userObj.geo && typeof userObj.geo.lat === 'number') coords.push(userObj.geo);
  const normList = extractNormalizedLocations(userObj.locations && userObj.locations.length > 0 ? userObj.locations : userObj.telepules);
  normList.forEach(loc => {
    if (CITY_COORDINATES[loc.canonicalKey]) {
      coords.push({ lat: CITY_COORDINATES[loc.canonicalKey].lat, lng: CITY_COORDINATES[loc.canonicalKey].lng });
    }
  });
  return coords;
}

function getMinDistanceToUser(myCoords, targetUser) {
  if (!myCoords) return null;
  const targetCoordsList = getUserAllCoordinates(targetUser);
  if (targetCoordsList.length === 0) return null;

  let minDist = Infinity;
  targetCoordsList.forEach(c => {
    const d = calculateDistanceKm(myCoords.lat, myCoords.lng, c.lat, c.lng);
    if (d !== null && d < minDist) minDist = d;
  });
  return minDist === Infinity ? null : minDist;
}

function requestGpsLocation(callback) {
  const statusEl = document.getElementById('search-gps-status');
  if (!navigator.geolocation) {
    showToast("A böngésződ nem támogatja a GPS-t.");
    if (callback) callback(false);
    return;
  }

  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.innerHTML = '<span style="color:var(--amber);">📍 Helyzet bemérése folyamatban...</span>';
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      myGpsCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      myProfile.geo = myGpsCoords;
      localStorage.setItem('cserelj_gps_coords', JSON.stringify(myGpsCoords));
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--moss-soft);">✓ Helyzet sikeresen rögzítve!</span>';
      showToast("GPS koordináták rögzítve!");
      renderMatches();
      renderProximityPartners();
      if (callback) callback(true);
    },
    (err) => {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger);">Nem sikerült lekérni a pozíciót.</span>';
      showToast("GPS hiba: " + err.message);
      if (callback) callback(false);
    },
    { timeout: 10000, enableHighAccuracy: true }
  );
}

safeAddListener('btn-search-gps-locate', () => requestGpsLocation());

document.querySelectorAll('#search-radius-group .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const radius = btn.dataset.radius;
    document.querySelectorAll('#search-radius-group .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSearchRadius = radius;
    proximityDisplayLimit = 25;

    if (radius !== 'all' && radius !== 'city' && !myGpsCoords) {
      requestGpsLocation(() => renderProximityPartners());
    } else {
      renderProximityPartners();
    }
  });
});

safeAddListener('btn-match-all', 'click', function() { setActiveMatchFilter(this, 'all'); });
safeAddListener('btn-match-city', 'click', function() {
  if (!myProfile.telepules && (!myProfile.locations || myProfile.locations.length === 0)) {
    return showToast("Előbb add meg a településed a Profil fülön!");
  }
  setActiveMatchFilter(this, 'city');
});
safeAddListener('btn-match-gift', 'click', function() { setActiveMatchFilter(this, 'gift'); });
safeAddListener('btn-match-loop', 'click', function() { setActiveMatchFilter(this, 'loop'); });

function refreshMatchesIfVisible() {
  const v = document.getElementById('view-cserek');
  if (v && v.classList.contains('active')) renderMatches();
}

function setActiveMatchFilter(btn, filterType) {
  document.querySelectorAll('#view-cserek .filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  matchFilter = filterType;
  renderMatches();
}

safeAddListener('btn-refresh-matches', () => {
  renderMatches();
  showToast("Párosítások frissítve.");
});

function computeLoopMatches() {
  const myId = currentUser ? currentUser.uid : 'me';
  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const otherUsers = allUsersData.filter(u => u.id !== myId);
  const loops = [];

  for (let i = 0; i < otherUsers.length; i++) {
    const userB = otherUsers[i];
    const bVanSet = new Set(ensureArray(userB.van));
    const bKellSet = new Set(ensureArray(userB.kell).filter(n => !bVanSet.has(n)));
    const giveToB = [...myVanSet].filter(n => bKellSet.has(n) && !bVanSet.has(n)).sort((a, b) => a - b);
    if (giveToB.length === 0) continue;

    for (let j = 0; j < otherUsers.length; j++) {
      if (i === j) continue;
      const userC = otherUsers[j];
      const cVanSet = new Set(ensureArray(userC.van));
      const cKellSet = new Set(ensureArray(userC.kell).filter(n => !cVanSet.has(n)));
      const giveBtoC = [...bVanSet].filter(n => cKellSet.has(n) && !cVanSet.has(n)).sort((a, b) => a - b);
      if (giveBtoC.length === 0) continue;

      const giveCtoMe = [...cVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
      if (giveCtoMe.length === 0) continue;

      const isLocalLoop = isLocalCityMatch(myProfile.locations || myProfile.telepules, userB.locations || userB.telepules) &&
                          isLocalCityMatch(userB.locations || userB.telepules, userC.locations || userC.telepules);
      loops.push({ userB, userC, giveToB, giveBtoC, giveCtoMe, isLocalLoop });
    }
  }
  return loops;
}

function renderMatches() {
  const list = document.getElementById('matches-list');
  if (!list) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const myCoords = myGpsCoords || getUserCoordinates(myProfile);

  if (matchFilter === 'loop') {
    const loops = computeLoopMatches();
    if (loops.length === 0) {
      list.innerHTML = `<div class="card" style="text-align:center; padding:20px;"><h3>Nincs elérhető 3 fős körcsere</h3><p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Ahogy több gyűjtő rögzít duplákat, automatikusan felajánljuk a 3 fős kombinációkat!</p></div>`;
      return;
    }

    list.innerHTML = `
      <div class="notice-banner" style="margin-bottom:12px;"><span><strong>Körcsere:</strong> Te adsz B-nek, B ad C-nek, C pedig ad Neked!</span></div>
      ${loops.slice(0, 10).map((l, loopIdx) => `
        <div class="card ${l.isLocalLoop ? 'card-local' : ''}">
          <div class="card-header-row">
            <h3 style="margin:0;">Körcsere: Te ➔ ${escapeHtml(l.userB.nev || 'B')} ➔ ${escapeHtml(l.userC.nev || 'C')} ➔ Te</h3>
            ${l.isLocalLoop ? '<span class="badge-local">Helyi csere</span>' : ''}
          </div>
          <div style="font-size:0.85rem; margin:8px 0; background:rgba(0,0,0,0.25); padding:8px; border-radius:var(--radius-sm); line-height:1.6;">
            <p style="margin:0;">1. <strong>Te adsz neki:</strong> ${escapeHtml(l.userB.nev)} (${escapeHtml(l.userB.telepules || '')}) ➔ ${l.giveToB.map(n => getItemLabel(n)).join(', ')}</p>
            <p style="margin:0;">2. <strong>Ő ad tovább:</strong> ${escapeHtml(l.userB.nev)} ad ${escapeHtml(l.userC.nev)}-nek ➔ ${l.giveBtoC.map(n => getItemLabel(n)).join(', ')}</p>
            <p style="margin:0; color:var(--moss-soft);">3. <strong>Te kapsz tőle:</strong> ${escapeHtml(l.userC.nev)} (${escapeHtml(l.userC.telepules || '')}) ➔ ${l.giveCtoMe.map(n => getItemLabel(n)).join(', ')}</p>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="btn btn-primary" style="flex:1; font-size:0.8rem;" data-action="contact-loop-b" data-loop-idx="${loopIdx}">Üzenet: ${escapeHtml(l.userB.nev)}</button>
            <button class="btn btn-secondary" style="flex:1; font-size:0.8rem;" data-action="contact-loop-c" data-loop-idx="${loopIdx}">Üzenet: ${escapeHtml(l.userC.nev)}</button>
          </div>
        </div>
      `).join('')}
    `;
    return;
  }

  let matches = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .map(u => {
      const uVanSet = new Set(ensureArray(u.van));
      const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
      const give = [...myVanSet].filter(n => uKellSet.has(n) && !uVanSet.has(n)).sort((a, b) => a - b);
      const get = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
      const score = Math.min(give.length, get.length);
      const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);
      const isGift = u.isGiftOffering === true;
      const distanceKm = getMinDistanceToUser(myCoords, u);
      return { ...u, give, get, score, isSameCity, isGift, distanceKm };
    })
    .filter(m => m.score > 0 || (m.isGift && m.get.length > 0));

  if (matchFilter === 'city') matches = matches.filter(m => m.isSameCity);
  if (matchFilter === 'gift') matches = matches.filter(m => m.isGift);

  matches.sort((a, b) => {
    if (b.isSameCity !== a.isSameCity) return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    return b.score - a.score;
  });

  if (matches.length === 0) {
    list.innerHTML = '<p class="view-intro">Jelenleg nincs a szűrésnek megfelelő cserepartner ehhez a gyűjteményhez.</p>';
    return;
  }

  list.innerHTML = matches.map((m) => {
    const isCheckedInPlan = selectedTradePlanUids.has(m.id);
    const distBadge = m.distanceKm !== null ? `<span style="font-size:0.75rem; color:var(--amber); font-weight:700;">📍 kb. ${m.distanceKm} km</span>` : '';
    const trustBadge = m.ratingsCount > 0 
      ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${(m.trustScore / m.ratingsCount).toFixed(1)} (${m.ratingsCount})</span>`
      : (m.trustScore > 0 ? `<span style="font-size:0.75rem; color:var(--gift-gold); font-weight:800;">⭐ ${m.trustScore}</span>` : '');

    return `
    <div class="card ${m.isSameCity ? 'card-local' : ''}">
      <div class="card-header-row">
        <div>
          <h3 style="margin:0; cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">
            ${escapeHtml(m.nev || 'Névtelen')} ${m.telepules ? `(${escapeHtml(m.telepules)})` : ''} ${trustBadge}
          </h3>
          ${distBadge}
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
          ${m.isSameCity ? '<span class="badge-local">Helyi csere</span>' : ''}
          ${m.isGift ? '<span class="badge-gift">Ingyen felajánló</span>' : ''}
          <span class="badge-ratio">${m.give.length} db ⇄ ${m.get.length} db</span>
        </div>
      </div>
      <p style="margin:4px 0;"><strong>Te adnád neki:</strong> ${m.give.length ? m.give.map(n => getItemLabel(n)).join(', ') : '<em>(Ajándékba kapod)</em>'}</p>
      <p style="margin:4px 0;"><strong>Ő adná neked:</strong> ${m.get.map(n => {
        const qty = (m.vanCounts && m.vanCounts[n] > 1) ? ` (${m.vanCounts[n]} db)` : '';
        return `${getItemLabel(n)}${qty}`;
      }).join(', ')}</p>
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; border-top:1px solid rgba(243,238,223,0.1); padding-top:8px;">
        <label class="checkbox-label" style="margin:0; font-size:0.8rem; color:var(--sand); font-weight:600;">
          <input type="checkbox" class="trade-plan-check" data-uid="${escapeHtml(m.id)}" ${isCheckedInPlan ? 'checked' : ''}>
          Hozzáadás a Csere-tervhez
        </label>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-contact-green btn-sm" data-action="contact-match" data-uid="${escapeHtml(m.id)}">Kapcsolatfelvétel</button>
          <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(m.id)}">Adatlap</button>
        </div>
      </div>
    </div>
  `}).join('');

  updateTradePlannerBar();
}

safeAddListener('matches-list', 'change', (e) => {
  const check = e.target.closest('.trade-plan-check');
  if (!check) return;
  const uid = check.dataset.uid;
  if (check.checked) selectedTradePlanUids.add(uid);
  else selectedTradePlanUids.delete(uid);
  updateTradePlannerBar();
});

function updateTradePlannerBar() {
  const bar = document.getElementById('trade-planner-floating-bar');
  const countSpan = document.getElementById('planner-selected-count');
  const topBtn = document.getElementById('btn-top-open-planner');
  const topCount = document.getElementById('planner-top-count');

  const count = selectedTradePlanUids.size;
  if (countSpan) countSpan.textContent = count;
  if (topCount) topCount.textContent = count;

  if (count >= 2) {
    if (bar) bar.style.display = 'flex';
    if (topBtn) topBtn.style.display = 'inline-flex';
  } else {
    if (bar) bar.style.display = 'none';
    if (topBtn) topBtn.style.display = 'none';
  }
}

safeAddListener('btn-clear-trade-plan', () => {
  selectedTradePlanUids.clear();
  tradePlanManualOverrides = {};
  document.querySelectorAll('.trade-plan-check').forEach(c => c.checked = false);
  updateTradePlannerBar();
});

safeAddListener('btn-open-trade-planner', () => {
  renderTradePlannerModal();
  document.getElementById('modal-trade-planner')?.classList.add('open');
});
safeAddListener('btn-top-open-planner', () => {
  renderTradePlannerModal();
  document.getElementById('modal-trade-planner')?.classList.add('open');
});
safeAddListener('btn-close-trade-planner', () => document.getElementById('modal-trade-planner')?.classList.remove('open'));
safeAddListener('btn-close-trade-planner-2', () => document.getElementById('modal-trade-planner')?.classList.remove('open'));

function renderTradePlannerModal() {
  const conflictBox = document.getElementById('trade-plan-conflicts-section');
  const breakdownBox = document.getElementById('trade-plan-partners-breakdown');
  const summaryBox = document.getElementById('trade-plan-summary-box');
  if (!conflictBox || !breakdownBox || !summaryBox) return;

  const selectedUsers = allUsersData.filter(u => selectedTradePlanUids.has(u.id));
  if (selectedUsers.length < 2) return;

  const myVanSet = new Set(ensureArray(myProfile.van));
  const myKellSet = new Set(ensureArray(myProfile.kell).filter(n => !myVanSet.has(n)));
  const stickerDemandMap = {};

  selectedUsers.forEach(u => {
    const uVanSet = new Set(ensureArray(u.van));
    const uKellSet = new Set(ensureArray(u.kell).filter(n => !uVanSet.has(n)));
    const totalGivesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).length;
    const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);

    [...myVanSet].filter(n => uKellSet.has(n)).forEach(stickerNum => {
      if (!stickerDemandMap[stickerNum]) stickerDemandMap[stickerNum] = [];
      stickerDemandMap[stickerNum].push({ user: u, totalGivesToMe, isSameCity });
    });
  });

  const conflicts = [];
  const allocation = {};
  selectedUsers.forEach(u => allocation[u.id] = []);

  Object.entries(stickerDemandMap).forEach(([nStr, demandList]) => {
    const num = parseInt(nStr, 10);
    const myQty = myProfile.vanCounts?.[num] || 1;

    if (demandList.length > myQty) {
      conflicts.push({ num, demandList, myQty });
      let assignedUid = tradePlanManualOverrides[num];
      if (!assignedUid) {
        assignedUid = [...demandList].sort((a, b) => b.totalGivesToMe - a.totalGivesToMe)[0].user.id;
      }
      if (allocation[assignedUid]) allocation[assignedUid].push(num);
    } else {
      demandList.forEach(d => { if (allocation[d.user.id]) allocation[d.user.id].push(num); });
    }
  });

  conflictBox.innerHTML = conflicts.length === 0
    ? `<div class="notice-banner" style="background:rgba(107,138,90,0.15); border-color:var(--moss-soft); color:var(--text-primary);"><strong>Nincs ütközés:</strong> Minden partnernek jut az általuk kért dupládból!</div>`
    : `<div class="card" style="border:1.5px solid var(--danger); background:rgba(232,90,79,0.12);"><h4 style="margin:0 0 6px; color:#FFC0BA;">Ütköző tételek (${conflicts.length} db)</h4>${conflicts.map(c => `<div><strong>#${c.num}</strong>: válassz partnert...</div>`).join('')}</div>`;

  breakdownBox.innerHTML = selectedUsers.map(u => {
    const uVanSet = new Set(ensureArray(u.van));
    const givesToMe = [...uVanSet].filter(n => myKellSet.has(n) && !myVanSet.has(n)).sort((a, b) => a - b);
    const allocatedToHim = (allocation[u.id] || []).sort((a, b) => a - b);

    return `
      <div class="card" style="margin-bottom:8px; padding:10px;">
        <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules || '')})
        <p style="margin:2px 0; font-size:0.8rem;">Adsz neki: ${allocatedToHim.map(n => getItemLabel(n)).join(', ') || 'Semmit'}</p>
        <p style="margin:2px 0; font-size:0.8rem; color:var(--moss-soft);">Kapsz tőle: ${givesToMe.map(n => getItemLabel(n)).join(', ')}</p>
        <button class="btn btn-contact-green btn-sm" data-action="contact-planned-partner" data-uid="${escapeHtml(u.id)}" data-give="${allocatedToHim.join(',')}" data-get="${givesToMe.join(',')}" style="margin-top:6px;">Üzenet küldése</button>
      </div>
    `;
  }).join('');

  summaryBox.innerHTML = `<strong>Szimulált végeredmény:</strong> Mind a ${selectedUsers.length} partnerrel előkészítve a csere.`;
}

safeAddListener('trade-plan-partners-breakdown', 'click', (e) => {
  const btn = e.target.closest('[data-action="contact-planned-partner"]');
  if (!btn) return;
  const targetUser = allUsersData.find(u => u.id === btn.dataset.uid);
  if (!targetUser) return;
  document.getElementById('modal-trade-planner')?.classList.remove('open');
  openContactModal(targetUser, ensureArray(btn.dataset.give), ensureArray(btn.dataset.get), targetUser.isGiftOffering);
});

// =========================================================================
// KAPCSOLATFELVÉTELI RENDSZER: EGYEDI AJÁNLAT BEVITELI RUBRIKÁVAL
// =========================================================================

let activeContactGiveNums = [];
let activeContactGetNums = [];
let excludedGiveNums = new Set();
let excludedGetNums = new Set();

function setupContactModal(targetUser, subject, rawGiveNums = [], rawGetNums = [], isGift = false) {
  activeContactTarget = {
    uid: targetUser.id || targetUser.uid || '',
    nev: targetUser.nev || 'Gyűjtőpartner',
    telepules: targetUser.telepules || '',
    email: targetUser.email || '',
    showEmail: targetUser.showEmailToUsers === true,
    isGift: isGift,
    subject: subject
  };

  activeContactGiveNums = ensureArray(rawGiveNums);
  activeContactGetNums = ensureArray(rawGetNums);
  excludedGiveNums.clear();
  excludedGetNums.clear();

  const titleEl = document.getElementById('contact-modal-title');
  if (titleEl) titleEl.textContent = `Üzenet küldése: ${escapeHtml(activeContactTarget.nev)}`;

  // Töröljük a korábbi egyedi ajánlatot
  const customOfferInput = document.getElementById('contact-custom-offer-input');
  if (customOfferInput) customOfferInput.value = '';

  renderContactChips();
  updateContactModalText();
  document.getElementById('modal-contact')?.classList.add('open');
}

function renderContactChips() {
  const giveBox = document.getElementById('contact-give-chips');
  const getBox = document.getElementById('contact-get-chips');
  const giveWrapper = document.getElementById('contact-give-chips-wrapper');
  const getWrapper = document.getElementById('contact-get-chips-wrapper');

  if (giveWrapper) giveWrapper.style.display = activeContactGiveNums.length > 0 ? 'block' : 'none';
  if (getWrapper) getWrapper.style.display = activeContactGetNums.length > 0 ? 'block' : 'none';

  if (giveBox) {
    giveBox.innerHTML = activeContactGiveNums.map(n => `
      <span class="contact-item-chip ${excludedGiveNums.has(n) ? 'excluded' : ''}" data-action="toggle-give-chip" data-num="${n}">
        ${escapeHtml(getItemLabel(n, currentAlbumId))} <span class="chip-del">✕</span>
      </span>
    `).join('');
  }

  if (getBox) {
    getBox.innerHTML = activeContactGetNums.map(n => `
      <span class="contact-item-chip ${excludedGetNums.has(n) ? 'excluded' : ''}" data-action="toggle-get-chip" data-num="${n}" style="border-color:var(--moss-soft);">
        ${escapeHtml(getItemLabel(n, currentAlbumId))} <span class="chip-del">✕</span>
      </span>
    `).join('');
  }
}

safeAddListener('contact-chips-editor-section', 'click', (e) => {
  const chip = e.target.closest('[data-action]');
  if (!chip) return;
  const num = parseInt(chip.dataset.num, 10);
  if (isNaN(num)) return;

  if (chip.dataset.action === 'toggle-give-chip') {
    if (excludedGiveNums.has(num)) excludedGiveNums.delete(num);
    else excludedGiveNums.add(num);
  } else if (chip.dataset.action === 'toggle-get-chip') {
    if (excludedGetNums.has(num)) excludedGetNums.delete(num);
    else excludedGetNums.add(num);
  }

  renderContactChips();
  updateContactModalText();
});

// Dinamikusan frissíti a levelet, ha a felhasználó beír egy egyedi ajánlatot (pl. "2 csoki")
document.getElementById('contact-custom-offer-input')?.addEventListener('input', () => {
  updateContactModalText();
});

function updateContactModalText() {
  const inputEl = document.getElementById('contact-msg-input');
  if (!inputEl) return;

  const activeAlbum = getActiveAlbum();
  const effectiveGiveList = activeContactGiveNums.filter(n => !excludedGiveNums.has(n)).map(n => getItemLabel(n, currentAlbumId));
  const effectiveGet = activeContactGetNums.filter(n => !excludedGetNums.has(n)).map(n => getItemLabel(n, currentAlbumId)).join(', ');
  
  // Egyedi ajánlat rubrika szövege (pl. csoki, pénz, egyedi matricák)
  const customOfferText = (document.getElementById('contact-custom-offer-input')?.value || '').trim();

  let giveLine = '';
  if (customOfferText && effectiveGiveList.length > 0) {
    giveLine = `${effectiveGiveList.join(', ')} + ${customOfferText}`;
  } else if (customOfferText) {
    giveLine = customOfferText;
  } else if (effectiveGiveList.length > 0) {
    giveLine = effectiveGiveList.join(', ');
  } else {
    giveLine = '(egyeztetés alatt)';
  }

  let msg = '';
  if (activeContactTarget.isGift && !effectiveGiveList.length && !customOfferText) {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan oldalon láttam a felajánlásodat a(z) ${activeAlbum.title} gyűjteményből.\nSzeretném elkérni az alábbi tételeket:\n${effectiveGet || 'egyeztetés alatt'}\n\nHogyan tudnánk megoldani az átadást?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
  } else {
    msg = `Szia ${activeContactTarget.nev}!\n\nA Cserélj Okosan platformon találtam meg a profilodat (${activeAlbum.title}):\n\nÉn tudom adni neked: ${giveLine}\nTe tudod adni nekem: ${effectiveGet || '(egyeztetés alatt)'}\n\nMegfelelne a csere személyesen vagy postán?\n\nÜdvözlettel,\n${myProfile.nev} (${myProfile.telepules || ''})`;
  }

  inputEl.value = msg;
}

function openContactModal(targetUser, giveArray, getArray, isGift) {
  if (!checkSenderProfileReady()) return;
  setupContactModal(targetUser, `${getActiveAlbum().title} csere megkeresés`, ensureArray(giveArray), ensureArray(getArray), isGift);
}

function openLoopContactModal(targetUser, thirdPersonName, stickersArray, role) {
  if (!checkSenderProfileReady()) return;
  setupContactModal(targetUser, `${getActiveAlbum().title} 3 fős körcsere`, ensureArray(stickersArray), [], false);
}

function openDirectContactModal(targetUser, numsArray, isGift) {
  if (!checkSenderProfileReady()) return;
  setupContactModal(targetUser, `${getActiveAlbum().title} tétel érdeklődés`, [], ensureArray(numsArray), isGift);
}

// BELSŐ ÜZENET KÜLDÉSE (MESSENGER-PIPÁVAL ÉS ZÁROLÁSSAL)
safeAddListener('btn-send-message', () => {
  const messageText = document.getElementById('contact-msg-input')?.value.trim() || '';
  if (!messageText) return showToast("Kérlek írj be egy üzenetet!");

  const loader = document.getElementById('contact-send-loader');
  const sendBtn = document.getElementById('btn-send-message');
  const autoCreateTrade = document.getElementById('contact-auto-create-trade')?.checked !== false;

  if (loader) loader.style.display = 'block';
  if (sendBtn) sendBtn.disabled = true;

  const effectiveGiveNums = activeContactGiveNums.filter(n => !excludedGiveNums.has(n));
  const effectiveGetNums = activeContactGetNums.filter(n => !excludedGetNums.has(n));

  (async () => {
    try {
      if (db && currentUser) {
        const threadId = [currentUser.uid, activeContactTarget.uid].sort().join('_') + '_' + currentAlbumId;

        await db.collection("messages").add({
          fromUid: currentUser.uid,
          fromName: myProfile.nev,
          fromCity: myProfile.telepules || '',
          toUid: activeContactTarget.uid,
          toName: activeContactTarget.nev,
          albumId: currentAlbumId,
          threadId: threadId,
          subject: activeContactTarget.subject,
          message: messageText,
          text: messageText,
          read: false, // 1 pipa: kézbesítve
          readAt: null,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      // Rögzítés a rács alatti cserékbe & Zárolás
      if (autoCreateTrade && (effectiveGiveNums.length > 0 || effectiveGetNums.length > 0)) {
        if (!myProfile.activeTrades) myProfile.activeTrades = [];
        myProfile.activeTrades.unshift({
          partnerUid: activeContactTarget.uid,
          partnerName: activeContactTarget.nev,
          partnerCity: activeContactTarget.telepules || 'Partner',
          albumId: currentAlbumId,
          givingItems: effectiveGiveNums,
          receivingItems: effectiveGetNums,
          createdAt: Date.now(),
          status: 'pending'
        });

        effectiveGiveNums.forEach(n => {
          if (!myProfile.foglalva.includes(n)) myProfile.foglalva.push(n);
          if (!myProfile.foglalvaCounts) myProfile.foglalvaCounts = {};
          myProfile.foglalvaCounts[n] = (myProfile.foglalvaCounts[n] || 0) + 1;
        });

        saveMyState();
        renderActiveTradesPanel();
        renderGrid();
      }

      try {
        const idToken = currentUser ? await currentUser.getIdToken() : '';
        await fetch(WORKER_ENDPOINT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
          body: JSON.stringify({
            toEmail: activeContactTarget.email || '',
            toUid: activeContactTarget.uid,
            toName: activeContactTarget.nev,
            fromUid: currentUser ? currentUser.uid : '',
            fromName: myProfile.nev,
            senderCity: myProfile.telepules || '',
            subject: activeContactTarget.subject,
            message: messageText
          })
        });
      } catch (e) {}

      showToast("Üzeneted elküldve (✓ Kézbesítve)! Csere rögzítve a rácsod alatt.");
      document.getElementById('modal-contact')?.classList.remove('open');
    } catch (err) {
      showToast("Hiba: " + err.message);
    } finally {
      if (loader) loader.style.display = 'none';
      if (sendBtn) sendBtn.disabled = false;
    }
  })();
});

safeAddListener('btn-close-contact', () => document.getElementById('modal-contact')?.classList.remove('open'));
safeAddListener('btn-copy-msg', () => {
  navigator.clipboard.writeText(document.getElementById('contact-msg-input')?.value || '');
  showToast("Üzenet kimásolva!");
});

// =========================================================================
// RÁCS ALATTI CSERÉK & ARCHÍVUM
// =========================================================================

let activeTradeClosingData = null;

function renderActiveTradesPanel() {
  const panel = document.getElementById('active-trades-panel');
  const list = document.getElementById('active-trades-list');
  const countSpan = document.getElementById('active-trades-count');
  if (!panel || !list) return;

  const allTrades = myProfile.activeTrades || [];
  const pendingTrades = allTrades.filter(t => t.status !== 'completed');
  const completedTrades = allTrades.filter(t => t.status === 'completed');

  if (countSpan) countSpan.textContent = pendingTrades.length;
  if (pendingTrades.length === 0 && completedTrades.length === 0) {
    panel.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  panel.style.display = 'block';

  let html = '';
  if (pendingTrades.length > 0) {
    html += pendingTrades.map((t) => {
      const originalIdx = allTrades.indexOf(t);
      return `
        <div class="trade-manage-card" data-trade-idx="${originalIdx}">
          <div class="trade-manage-header">
            <div><strong style="color:#FFF;">${escapeHtml(t.partnerName)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${escapeHtml(t.partnerCity || 'Partner')})</span></div>
            <span class="badge-trade-status badge-status-reserved">🔒 Zárolva / Folyamatban</span>
          </div>
          <div style="font-size:0.8rem; margin:6px 0; background:rgba(0,0,0,0.2); padding:8px; border-radius:var(--radius-sm);">
            <p style="margin:2px 0;"><strong>Te adod (Lefoglalva):</strong> ${t.givingItems?.map(n => getItemLabel(n)).join(', ') || 'Nincs'}</p>
            <p style="margin:2px 0; color:var(--moss-soft);"><strong>Tőle várod:</strong> ${t.receivingItems?.map(n => getItemLabel(n)).join(', ') || 'Ajándék'}</p>
          </div>
          <div style="display:flex; justify-content:space-between; margin-top:8px; gap:6px;">
            <button class="btn btn-contact-green btn-sm" data-action="complete-trade" data-trade-idx="${originalIdx}">✓ Megérkezett / Lezárás</button>
            <button class="btn btn-secondary btn-sm" data-action="cancel-trade" data-trade-idx="${originalIdx}" style="color:var(--danger); border-color:var(--danger);">✕ Visszavonás</button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    html += '<p style="font-size:0.8rem; color:var(--sand);">Nincs aktív, folyamatban lévő cseréd.</p>';
  }

  if (completedTrades.length > 0) {
    html += `
      <details class="archived-trades-details" style="margin-top:12px; border-top:1px dashed rgba(243,238,223,0.15); padding-top:8px;">
        <summary style="font-size:0.8rem; color:var(--amber); cursor:pointer; font-weight:700;">
          ▶ Korábbi sikeres cseréid (${completedTrades.length} db lezárva)
        </summary>
        <div style="margin-top:6px; display:flex; flex-direction:column; gap:4px;">
          ${completedTrades.map(t => `
            <div style="background:rgba(0,0,0,0.25); padding:6px 8px; border-radius:var(--radius-sm); font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between;">
              <span><strong>${escapeHtml(t.partnerName)}</strong>: ${t.givingItems?.map(n => getItemLabel(n)).join(',') || '-'} ➔ ${t.receivingItems?.map(n => getItemLabel(n)).join(',') || '-'}</span>
              <span style="color:var(--moss-soft); font-weight:700;">✓ Teljesítve</span>
            </div>
          `).join('')}
        </div>
      </details>
    `;
  }
  list.innerHTML = html;
}

safeAddListener('active-trades-list', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const idx = parseInt(btn.dataset.tradeIdx, 10);
  const trade = (myProfile.activeTrades || [])[idx];
  if (!trade) return;

  if (btn.dataset.action === 'complete-trade') {
    activeTradeClosingData = { trade, tradeIdx: idx };
    const titleEl = document.getElementById('rate-modal-title');
    if (titleEl) titleEl.textContent = `Csere lezárása: ${trade.partnerName}`;
    document.getElementById('modal-rate-trade')?.classList.add('open');
  } else if (btn.dataset.action === 'cancel-trade') {
    if (!confirm("Feloldod a lefoglalt tételeket és visszavonod a cserét?")) return;
    myProfile.activeTrades.splice(idx, 1);
    saveMyState();
    renderActiveTradesPanel();
    renderGrid();
    showToast("Csere visszavonva, a tételek újra szabadok.");
  }
});

let selectedStarRating = 5;
document.querySelectorAll('#trade-star-rating-box .star-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedStarRating = parseInt(btn.dataset.rating, 10);
    document.querySelectorAll('#trade-star-rating-box .star-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.rating, 10) <= selectedStarRating);
    });
  });
});

safeAddListener('btn-close-rate-modal', () => document.getElementById('modal-rate-trade')?.classList.remove('open'));

safeAddListener('btn-submit-trade-rating', async () => {
  if (!activeTradeClosingData) return;
  const { trade, tradeIdx } = activeTradeClosingData;
  const commentText = document.getElementById('rate-modal-comment')?.value.trim() || '';

  if (trade.receivingItems) {
    trade.receivingItems.forEach(n => {
      const kIdx = myProfile.kell.indexOf(n);
      if (kIdx > -1) myProfile.kell.splice(kIdx, 1);
      if (!myProfile.van.includes(n)) { myProfile.van.push(n); myProfile.vanCounts[n] = 1; }
    });
  }

  if (trade.givingItems) {
    trade.givingItems.forEach(n => {
      if (myProfile.vanCounts && myProfile.vanCounts[n]) {
        myProfile.vanCounts[n] = Math.max(0, myProfile.vanCounts[n] - 1);
        if (myProfile.vanCounts[n] === 0) {
          delete myProfile.vanCounts[n];
          const vIdx = myProfile.van.indexOf(n);
          if (vIdx > -1) myProfile.van.splice(vIdx, 1);
        }
      }
    });
  }

  myProfile.activeTrades[tradeIdx].status = 'completed';
  saveMyState();

  if (currentUser && db && trade.partnerUid) {
    try {
      await db.collection("public_profiles").doc(trade.partnerUid).collection("reviews").add({
        fromUid: currentUser.uid,
        fromName: myProfile.nev || 'Gyűjtőtárs',
        stars: selectedStarRating,
        comment: commentText,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("public_profiles").doc(trade.partnerUid).update({
        trustScore: firebase.firestore.FieldValue.increment(selectedStarRating),
        ratingsCount: firebase.firestore.FieldValue.increment(1)
      });
    } catch (e) {}
  }

  document.getElementById('modal-rate-trade')?.classList.remove('open');
  activeTradeClosingData = null;
  renderActiveTradesPanel();
  renderGrid();
  showToast("Csere sikeresen lezárva!");
});

// =========================================================================
// A 4 KERESŐBLOKK LOGIKÁJA (EGYSÉGESEN: CSEREINDÍTÁS GOMBOKKAL)
// =========================================================================

// 1. TÉTELKERESÉS AZ ALBUMBAN
safeAddListener('btn-search', () => {
  const raw = document.getElementById('search-input')?.value.trim() || '';
  if (!raw) return showToast("Írj be egy keresőszót!");
  const queryNorm = normalizeText(raw);
  const matchedNums = [];
  const totalSize = getActiveAlbumSize();

  const rangeMatch = raw.match(/^(\d+)[\s\-—–]+(\d+)$/);
  if (rangeMatch) {
    for (let i = Math.min(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)); i <= Math.max(parseInt(rangeMatch[1], 10), parseInt(rangeMatch[2], 10)); i++) {
      if (i >= 1 && i <= totalSize) matchedNums.push(i);
    }
  } else {
    const numTokens = raw.split(/[\s,;]+/).filter(t => /^\d+$/.test(t));
    if (numTokens.length > 0) {
      numTokens.forEach(n => { const num = parseInt(n, 10); if (num >= 1 && num <= totalSize) matchedNums.push(num); });
    } else {
      for (let i = 1; i <= totalSize; i++) {
        if (normalizeText(getItemFullName(i, currentAlbumId)).includes(queryNorm)) matchedNums.push(i);
      }
    }
  }

  if (matchedNums.length === 0) return showToast("Nincs találat.");
  document.getElementById('search-results').style.display = 'block';
  renderSearchResults(matchedNums.sort((a, b) => a - b), `Keresés: „${raw}”`);
});

document.getElementById('search-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-search')?.click(); }
});

safeAddListener('btn-close-item-search', () => {
  const c = document.getElementById('search-results');
  if (c) { c.style.display = 'none'; c.innerHTML = ''; }
  document.getElementById('btn-close-item-search').style.display = 'none';
});

safeAddListener('btn-search-all-missing', () => {
  const c = document.getElementById('search-results');
  if (c && c.style.display !== 'none' && c.dataset.mode === 'all-missing') {
    c.style.display = 'none'; c.innerHTML = ''; c.dataset.mode = '';
    document.getElementById('btn-close-item-search').style.display = 'none';
    return;
  }
  if (myProfile.kell.length === 0) return showToast("Nincs bejelölt hiányzód.");
  c.style.display = 'block'; c.dataset.mode = 'all-missing';
  renderSearchResults(myProfile.kell, `Összes hiányzód (${myProfile.kell.length} db)`);
});

function renderSearchResults(targetNums, titleText) {
  const container = document.getElementById('search-results');
  const closeBtn = document.getElementById('btn-close-item-search');
  if (!container) return;
  if (closeBtn) closeBtn.style.display = 'inline-block';

  const targetSet = new Set(targetNums);
  const matches = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : ''))
    .map(u => ({ ...u, found: ensureArray(u.van).filter(n => targetSet.has(n)).sort((a, b) => a - b) }))
    .filter(u => u.found.length > 0)
    .sort((a, b) => b.found.length - a.found.length);

  if (matches.length === 0) {
    container.innerHTML = `<p class="view-intro">${escapeHtml(titleText)} — Jelenleg senkinél sincs duplában.</p>`;
    return;
  }

  container.innerHTML = `
    <p class="view-intro" style="color:var(--sand);"><strong>${escapeHtml(titleText)}</strong> — ${matches.length} gyűjtőnél:</p>
    ${matches.map(u => `
      <div class="card">
        <div class="card-header-row">
          <h3 style="cursor:pointer;" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">${escapeHtml(u.nev)} (${escapeHtml(u.telepules)})</h3>
          ${u.isGiftOffering ? '<span class="badge-gift">Ingyen adja</span>' : ''}
        </div>
        <p><strong>Nála megvan (${u.found.length} db):</strong> ${u.found.map(n => getItemLabel(n)).join(', ')}</p>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <!-- 1. Tételkeresőnél maradt az "Érdekelnek a tételek" gomb -->
          <button class="btn btn-contact-green btn-sm" data-action="contact-search" data-uid="${escapeHtml(u.id)}" data-found="${u.found.join(',')}">
            Érdekelnek a tételek
          </button>
          <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">Adatlap</button>
        </div>
      </div>
    `).join('')}
  `;
}

safeAddListener('search-results', 'click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'contact-search') {
    const targetUser = allUsersData.find(u => u.id === btn.dataset.uid);
    if (targetUser) openDirectContactModal(targetUser, btn.dataset.found, targetUser.isGiftOffering);
  } else if (btn.dataset.action === 'inspect-user') {
    openUserProfileModal(btn.dataset.uid);
  }
});

// 2. KERESÉS TELEPÜLÉS SZERINT (GOMB: CSEREINDÍTÁS)
safeAddListener('btn-search-by-city', () => {
  const inputEl = document.getElementById('search-by-city-input');
  const statusEl = document.getElementById('city-search-status');
  const clearBtn = document.getElementById('btn-clear-city-search');
  const boxEl = document.getElementById('city-search-results-box');
  const listEl = document.getElementById('city-search-partners-list');
  const query = (inputEl?.value || '').trim();

  if (!query) return showToast("Írj be egy települést!");
  selectedCityFilter = query;

  const matchedUsers = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .filter(u => isLocalCityMatch(u.locations || u.telepules, query));

  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (boxEl) boxEl.style.display = 'block';
  if (statusEl) statusEl.innerHTML = `Találatok: <strong>${escapeHtml(query)}</strong> (${matchedUsers.length} gyűjtő):`;

  if (listEl) {
    listEl.innerHTML = matchedUsers.length === 0
      ? `<p style="font-size:0.8rem; color:var(--text-muted);">Nincs regisztrált gyűjtő ezen a településen.</p>`
      : matchedUsers.map(u => `
        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules)})
            <div style="font-size:0.75rem; color:var(--sand);">${ensureArray(u.van).length} db cserélhető dupla</div>
          </div>
          <div style="display:flex; gap:6px;">
            <!-- 2. Településkeresőnél a kért Csereindítás gomb -->
            <button class="btn btn-contact-green btn-sm" data-action="contact-partner" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">Adatlap</button>
          </div>
        </div>
      `).join('');
  }
});

document.getElementById('search-by-city-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-search-by-city')?.click(); }
});

safeAddListener('btn-clear-city-search', () => {
  document.getElementById('search-by-city-input').value = '';
  document.getElementById('city-search-results-box').style.display = 'none';
  document.getElementById('btn-clear-city-search').style.display = 'none';
  selectedCityFilter = '';
});

// 3. KÖZELI CSEREPARTNEREK TÁVOLSÁG SZERINT (GOMB: CSEREINDÍTÁS)
let proximityDisplayLimit = 25;

function renderProximityPartners() {
  const container = document.getElementById('proximity-partners-list');
  if (!container) return;

  const myCoords = myGpsCoords || getUserCoordinates(myProfile);
  const myId = currentUser ? currentUser.uid : 'me';

  let list = allUsersData
    .filter(u => u.id !== myId)
    .map(u => {
      const distanceKm = getMinDistanceToUser(myCoords, u);
      const isSameCity = isLocalCityMatch(myProfile.locations || myProfile.telepules, u.locations || u.telepules);
      const totalDupes = ensureArray(u.van).length;
      return { ...u, distanceKm, isSameCity, totalDupes };
    });

  if (selectedSearchRadius === 'city') list = list.filter(u => u.isSameCity);
  else if (selectedSearchRadius !== 'all') {
    const maxDist = parseInt(selectedSearchRadius, 10);
    list = list.filter(u => u.distanceKm !== null && u.distanceKm <= maxDist);
  }

  list.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    return (b.isSameCity ? 1 : 0) - (a.isSameCity ? 1 : 0);
  });

  const paginated = list.slice(0, proximityDisplayLimit);

  container.innerHTML = paginated.length === 0
    ? `<div style="text-align:center; padding:12px; font-size:0.85rem; color:var(--text-muted);">Nincs partner a megadott körzetben.</div>`
    : `
      ${paginated.map(u => `
        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules || '')})
            <div style="font-size:0.75rem; color:var(--amber);">${u.distanceKm !== null ? `📍 kb. ${u.distanceKm} km` : '📍 Nincs GPS'} • ${u.totalDupes} db dupla</div>
          </div>
          <div style="display:flex; gap:6px;">
            <!-- 3. Távolsági keresőnél a kért Csereindítás gomb -->
            <button class="btn btn-contact-green btn-sm" data-action="contact-partner" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">Adatlap</button>
          </div>
        </div>
      `).join('')}
      ${list.length > proximityDisplayLimit ? `<button class="btn btn-secondary btn-sm" id="btn-load-more-prox" style="width:100%; margin-top:8px;">+ További 25 mutatása</button>` : ''}
    `;
}

// 4. ÚJ BLOKK: CSEREPARTNER KERESÉSE NÉV ALAPJÁN (GOMB: CSEREINDÍTÁS)
safeAddListener('btn-search-by-name', () => {
  const inputEl = document.getElementById('search-by-name-input');
  const boxEl = document.getElementById('name-search-results-box');
  const statusEl = document.getElementById('name-search-status');
  const listEl = document.getElementById('name-search-partners-list');
  const clearBtn = document.getElementById('btn-clear-name-search');
  const query = (inputEl?.value || '').toLowerCase().trim();

  if (!query) return showToast("Írj be egy nevet a kereséshez!");

  const matched = allUsersData
    .filter(u => u.id !== (currentUser ? currentUser.uid : 'me'))
    .filter(u => (u.nev || '').toLowerCase().includes(query) || (u.telepules || '').toLowerCase().includes(query));

  if (clearBtn) clearBtn.style.display = 'inline-block';
  if (boxEl) boxEl.style.display = 'block';
  if (statusEl) statusEl.innerHTML = `Találatok: <strong>${escapeHtml(inputEl.value)}</strong> (${matched.length} gyűjtő):`;

  if (listEl) {
    listEl.innerHTML = matched.length === 0
      ? `<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Nem található gyűjtő ezzel a névvel.</p>`
      : matched.map(u => `
        <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:#FFF;">${escapeHtml(u.nev)}</strong> (${escapeHtml(u.telepules)})
            <div style="font-size:0.75rem; color:var(--sand);">${ensureArray(u.van).length} db cserélhető dupla</div>
          </div>
          <div style="display:flex; gap:6px;">
            <!-- 4. Névkeresőnél a kért Csereindítás gomb -->
            <button class="btn btn-contact-green btn-sm" data-action="contact-partner" data-uid="${escapeHtml(u.id)}">Csereindítás</button>
            <button class="btn btn-secondary btn-sm" data-action="inspect-user" data-uid="${escapeHtml(u.id)}">Adatlap</button>
          </div>
        </div>
      `).join('');
  }
});

document.getElementById('search-by-name-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-search-by-name')?.click(); }
});

safeAddListener('btn-clear-name-search', () => {
  document.getElementById('search-by-name-input').value = '';
  document.getElementById('name-search-results-box').style.display = 'none';
  document.getElementById('btn-clear-name-search').style.display = 'none';
});

// KÖZÖS ESEMÉNYFIGYELŐ A 2., 3., 4. KERESŐK GOMBJAIHOZ
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="contact-partner"]');
  if (btn) {
    const targetUser = allUsersData.find(u => u.id === btn.dataset.uid);
    if (targetUser) openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
  }

  const loadMoreBtn = e.target.closest('#btn-load-more-prox');
  if (loadMoreBtn) {
    proximityDisplayLimit += 25;
    renderProximityPartners();
  }
});

// =========================================================================
// KÉSZLETRADAR ÉS TALÁLKOZÓK
// =========================================================================

safeAddListener('radar-photo-input', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 600;
      let w = img.width, h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
        else { w = Math.round((w * maxDim) / h); h = maxDim; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      radarAttachedBase64 = canvas.toDataURL('image/jpeg', 0.65);
      const preview = document.getElementById('radar-photo-preview');
      if (preview) { preview.src = radarAttachedBase64; document.getElementById('radar-photo-preview-box').style.display = 'block'; }
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

safeAddListener('btn-submit-radar', async () => {
  if (!currentUser) return showToast("Előbb lépj be a fiókodba!");
  const rawStore = document.getElementById('radar-input-store')?.value.trim() || '';
  const note = document.getElementById('radar-input-note')?.value.trim() || '';
  const status = document.querySelector('input[name="radar-status"]:checked')?.value === 'van';

  if (!rawStore) return showToast("Add meg a boltot!");

  try {
    await db.collection("album_reports").add({
      albumId: currentAlbumId,
      fullStoreName: rawStore,
      note, status,
      photoBase64: radarAttachedBase64 || '',
      likes: [],
      reportedAt: firebase.firestore.FieldValue.serverTimestamp(),
      reporterName: myProfile.nev || 'Gyűjtő',
      userId: currentUser.uid
    });
    radarAttachedBase64 = '';
    document.getElementById('radar-input-store').value = '';
    document.getElementById('radar-input-note').value = '';
    document.getElementById('radar-photo-preview-box').style.display = 'none';
    showToast("Jelentés sikeresen elküldve!");
  } catch (err) { showToast("Hiba: " + err.message); }
});

safeAddListener('btn-refresh-radar', () => { renderRadarReports(); showToast("Radar frissítve."); });

function renderRadarReports() {
  const container = document.getElementById('radar-reports-list');
  if (!container) return;
  const filtered = radarReports.filter(r => (r.albumId || 'lidl-lutra-2026') === currentAlbumId);

  container.innerHTML = filtered.length === 0
    ? '<p class="view-intro">Nincs készletjelentés ehhez az albumhoz.</p>'
    : filtered.map(r => `
      <div class="radar-card">
        <div style="display:flex; justify-content:space-between;">
          <strong>${escapeHtml(r.fullStoreName)}</strong>
          <span class="${r.status ? 'badge-radar-van' : 'badge-radar-nincs'}">${r.status ? 'Kapható' : 'Elfogyott'}</span>
        </div>
        ${r.note ? `<p style="font-size:0.84rem; margin:4px 0;">„${formatLinksWithAnchors(r.note)}”</p>` : ''}
        ${r.photoBase64 ? `<img src="${r.photoBase64}" class="radar-attached-img" data-action="open-lightbox">` : ''}
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">${escapeHtml(r.reporterName || 'Gyűjtő')}</div>
      </div>
    `).join('');
}

function listenToRadarReports() {
  if (!db) return;
  if (radarUnsubscribe) radarUnsubscribe();
  radarUnsubscribe = db.collection("album_reports").orderBy("reportedAt", "desc").limit(35).onSnapshot(snap => {
    radarReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRadarReports();
  });
}

// TALÁLKOZÓK
safeAddListener('btn-submit-meetup', async () => {
  if (!currentUser) return showToast("Előbb lépj be!");
  const city = document.getElementById('meetup-input-city')?.value.trim();
  const time = document.getElementById('meetup-input-time')?.value.trim();
  const place = document.getElementById('meetup-input-place')?.value.trim();
  const desc = document.getElementById('meetup-input-desc')?.value.trim();

  if (!city || !time || !place) return showToast("Töltsd ki az adatokat!");

  try {
    await db.collection("meetups").add({
      albumId: currentAlbumId, city, time, place, description: desc,
      likes: [], postedAt: firebase.firestore.FieldValue.serverTimestamp(),
      organizerName: myProfile.nev || 'Gyűjtő', userId: currentUser.uid
    });
    document.getElementById('meetup-input-city').value = '';
    document.getElementById('meetup-input-time').value = '';
    document.getElementById('meetup-input-place').value = '';
    document.getElementById('meetup-input-desc').value = '';
    showToast("Találkozó közzétéve!");
  } catch (err) { showToast("Hiba: " + err.message); }
});

safeAddListener('btn-refresh-meetups', () => { renderMeetups(); showToast("Találkozók frissítve."); });

function renderMeetups() {
  const container = document.getElementById('meetups-list');
  if (!container) return;
  container.innerHTML = meetupEvents.length === 0
    ? '<p class="view-intro">Nincs meghirdetett közös cserenap.</p>'
    : meetupEvents.map(m => `
      <div class="meetup-card">
        <div style="display:flex; justify-content:space-between;">
          <h3 style="margin:0; font-size:1rem;">${escapeHtml(m.city)} — ${escapeHtml(m.place)}</h3>
          <span class="meetup-time-badge">${escapeHtml(m.time)}</span>
        </div>
        ${m.description ? `<p style="font-size:0.85rem; margin:6px 0;">${formatLinksWithAnchors(m.description)}</p>` : ''}
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:6px;">Szervező: ${escapeHtml(m.organizerName)}</div>
      </div>
    `).join('');
}

function listenToMeetups() {
  if (!db) return;
  if (meetupsUnsubscribe) meetupsUnsubscribe();
  meetupsUnsubscribe = db.collection("meetups").orderBy("postedAt", "desc").limit(30).onSnapshot(snap => {
    meetupEvents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMeetups();
  });
}
// =========================================================================
// 4/4. RÉSZ: LEAFLET VEKTORTÉRKÉP, CHUNKED JSON IMPORTŐR,
// OKOS SZÖVEG/AI BEEMELŐ, ADMIN ABC REND, AUTH ÉS BOOT
// =========================================================================

// =========================================================================
// LEAFLET.JS INTERAKTÍV VEKTORTÉRKÉP (5. FÁZIS)
// =========================================================================
let leafletMapInstance = null;
let leafletMarkersGroup = null;

function initLeafletMap() {
  const mapContainer = document.getElementById('leaflet-map-container');
  if (!mapContainer || typeof L === 'undefined') return;

  // Ha már inicializálva volt, csak frissítjük a méretét és markereit
  if (leafletMapInstance) {
    leafletMapInstance.invalidateSize();
    renderLeafletMarkers();
    return;
  }

  // Térkép inicializálása Magyarország középpontjával
  leafletMapInstance = L.map('leaflet-map-container', {
    center: [47.1625, 19.5033],
    zoom: 7,
    minZoom: 6,
    maxZoom: 14,
    scrollWheelZoom: true
  });

  // Sötét tónusú OpenStreetMap réteg CartoDB Dark Matter csempékkel
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(leafletMapInstance);

  leafletMarkersGroup = L.layerGroup().addTo(leafletMapInstance);
  renderLeafletMarkers();
}

function renderLeafletMarkers() {
  if (!leafletMapInstance || !leafletMarkersGroup) return;
  leafletMarkersGroup.clearLayers();

  // Összeszámoljuk a gyűjtőket és a duplákat városonként
  const cityMap = {};
  allUsersData.forEach(u => {
    const normLocs = extractNormalizedLocations(u.locations && u.locations.length > 0 ? u.locations : u.telepules);
    const dupeCount = ensureArray(u.van).length;

    normLocs.forEach(loc => {
      const coords = CITY_COORDINATES[loc.canonicalKey] || CITY_COORDINATES[normalizeText(loc.displayName)];
      if (coords && coords.lat && coords.lng) {
        if (!cityMap[loc.canonicalKey]) {
          cityMap[loc.canonicalKey] = {
            name: loc.displayName,
            lat: coords.lat,
            lng: coords.lng,
            collectors: [],
            totalDupes: 0
          };
        }
        cityMap[loc.canonicalKey].collectors.push(u);
        cityMap[loc.canonicalKey].totalDupes += dupeCount;
      }
    });
  });

  // Markerek elhelyezése a térképen
  Object.values(cityMap).forEach(c => {
    const count = c.collectors.length;
    const isCluster = count > 1;

    const iconHtml = isCluster
      ? `<div class="map-cluster-marker" style="width:32px; height:32px;">${count}</div>`
      : `<div class="map-single-marker" style="width:22px; height:22px;">1</div>`;

    const customIcon = L.divIcon({
      html: iconHtml,
      className: '',
      iconSize: isCluster ? [32, 32] : [22, 22],
      iconAnchor: isCluster ? [16, 16] : [11, 11]
    });

    const marker = L.marker([c.lat, c.lng], { icon: customIcon });

    marker.bindPopup(`
      <strong style="color:var(--amber); font-size:0.95rem;">${escapeHtml(c.name)}</strong><br>
      <span style="font-size:0.78rem; color:#FFF;">👥 <strong>${count} gyűjtő</strong> található itt</span><br>
      <span style="font-size:0.75rem; color:var(--sand);">🔄 ${c.totalDupes} db cserélhető dupla</span>
      <div style="margin-top:6px;">
        <button class="btn btn-primary btn-sm" style="font-size:0.72rem; padding:3px 8px;" onclick="filterMatchesByCityName('${escapeHtml(c.name)}')">
          Helyi partnerek mutatása
        </button>
      </div>
    `);

    leafletMarkersGroup.addLayer(marker);
  });
}

// =========================================================================
// BELSŐ ÜZENETEK: MESSENGER PIPÁK (✓/✓✓) ÉS OLVASOTTSÁG
// =========================================================================
safeAddListener('btn-msg-tab-inbox', () => {
  activeInboxTab = 'inbox';
  document.getElementById('btn-msg-tab-inbox')?.classList.add('active');
  document.getElementById('btn-msg-tab-sent')?.classList.remove('active');
  renderMessages();
});

safeAddListener('btn-msg-tab-sent', () => {
  activeInboxTab = 'sent';
  document.getElementById('btn-msg-tab-sent')?.classList.add('active');
  document.getElementById('btn-msg-tab-inbox')?.classList.remove('active');
  renderMessages();
});

safeAddListener('btn-refresh-inbox', () => { renderMessages(); showToast("Üzenetek frissítve."); });

function updateMsgAlbumFilterOptions() {
  const sel = document.getElementById('msg-album-filter-select');
  if (!sel) return;
  const used = new Set();
  [...myIncomingMessages, ...myOutgoingMessages].forEach(m => { if (m.albumId) used.add(m.albumId); });

  const currentVal = sel.value;
  sel.innerHTML = '<option value="all">📦 Minden gyűjtemény üzenetei</option>';
  used.forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `📦 ${getAlbumDisplayTitle(id)}`;
    sel.appendChild(opt);
  });
  if (currentVal && [...used, 'all'].includes(currentVal)) sel.value = currentVal;
}

safeAddListener('msg-album-filter-select', 'change', (e) => {
  msgAlbumFilter = e.target.value;
  renderMessages();
});

function renderMessages() {
  const container = document.getElementById('messages-inbox-list');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:20px;"><h3>Belépés szükséges</h3><p style="font-size:0.85rem; color:var(--text-muted);">Az üzeneteidhez lépj be a fiókodba.</p></div>`;
    return;
  }

  updateMsgAlbumFilterOptions();

  // Ha a beérkezőket nézi a címzett, azonnal megjelöljük olvasottként a feladónál!
  if (activeInboxTab === 'inbox' && db && myIncomingMessages.length > 0) {
    myIncomingMessages.forEach(msg => {
      if (msg.read !== true) {
        db.collection("messages").doc(msg.id).update({
          read: true,
          readAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    });
  }

  let list = activeInboxTab === 'inbox' ? myIncomingMessages : myOutgoingMessages;
  if (msgAlbumFilter !== 'all') list = list.filter(m => (m.albumId || 'lidl-lutra-2026') === msgAlbumFilter);

  if (list.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center; padding:20px;"><p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Nincs ${activeInboxTab === 'inbox' ? 'beérkező' : 'elküldött'} üzeneted.</p></div>`;
    return;
  }

  container.innerHTML = list.map(msg => {
    const isIncoming = activeInboxTab === 'inbox';
    const partnerName = isIncoming ? msg.fromName : msg.toName;
    const partnerCity = isIncoming ? (msg.fromCity ? `(${msg.fromCity})` : '') : '';
    const dateStr = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('hu-HU', { dateStyle: 'short', timeStyle: 'short' }) : 'Nemrég';
    const albumDisplay = getAlbumDisplayTitle(msg.albumId);

    // Kézbesítési pipák: 1 pipa = kézbesítve, 2 pipa = megnyitva
    let pipaHtml = '';
    if (!isIncoming) {
      pipaHtml = msg.read === true
        ? `<span class="msg-status-pipa msg-read-double" title="Megnyitva / Elolvasva">✓✓</span>`
        : `<span class="msg-status-pipa msg-delivered" title="Kézbesítve a postaládájába">✓</span>`;
    }

    return `
      <div class="message-card ${isIncoming ? 'incoming' : 'outgoing'}">
        <div class="message-header">
          <div>
            <strong>${isIncoming ? 'Feladó:' : 'Címzett:'} ${escapeHtml(partnerName)} ${escapeHtml(partnerCity)}</strong>
            <span class="message-album-badge" style="margin-left:6px; cursor:pointer;" data-action="filter-by-album" data-album-id="${escapeHtml(msg.albumId || 'lidl-lutra-2026')}">
              📦 ${escapeHtml(albumDisplay)}
            </span>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-size:0.75rem; color:var(--text-muted);">${dateStr}</span>
            ${pipaHtml}
          </div>
        </div>
        <div class="message-body">${formatLinksWithAnchors(msg.message || msg.text || '')}</div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          ${isIncoming ? `
            <button class="btn btn-sm btn-primary" data-action="reply-message" data-sender-uid="${escapeHtml(msg.fromUid)}" data-sender-name="${escapeHtml(msg.fromName)}">
              Válasz ${escapeHtml(msg.fromName)}-nek
            </button>
          ` : '<div></div>'}
          <button class="btn btn-secondary btn-sm" data-action="delete-message" data-msg-id="${escapeHtml(msg.id)}" style="color:var(--danger); border-color:var(--danger);">Törlés</button>
        </div>
      </div>
    `;
  }).join('');
}

safeAddListener('messages-inbox-list', (e) => {
  const badge = e.target.closest('[data-action="filter-by-album"]');
  if (badge) {
    msgAlbumFilter = badge.dataset.albumId;
    const sel = document.getElementById('msg-album-filter-select');
    if (sel) sel.value = msgAlbumFilter;
    renderMessages();
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  if (btn.dataset.action === 'reply-message') {
    openContactModal({ id: btn.dataset.senderUid, nev: btn.dataset.senderName }, [], [], false);
  } else if (btn.dataset.action === 'delete-message') {
    if (!confirm("Törölni szeretnéd ezt az üzenetet?")) return;
    db.collection("messages").doc(btn.dataset.msgId).update({
      [activeInboxTab === 'inbox' ? "deletedByRecipient" : "deletedBySender"]: true
    }).then(() => showToast("Üzenet törölve."));
  }
});

// =========================================================================
// GYŰJTŐ ADATLAPJA: ÉRTÉKELÉSEK, VÉLEMÉNYEK ÉS CSEREINDÍTÁS
// =========================================================================
async function openUserProfileModal(uid) {
  const targetUser = allUsersData.find(u => u.id === uid);
  if (!targetUser) return showToast("Gyűjtő adatai nem találhatók.");

  const modal = document.getElementById('modal-user-profile');
  if (!modal) return;

  document.getElementById('user-profile-modal-name').textContent = `Gyűjtő: ${targetUser.nev || 'Névtelen'}`;
  document.getElementById('user-profile-modal-city').textContent = targetUser.telepules ? `Település: ${targetUser.telepules}` : 'Nincs megadva település';

  const rCount = targetUser.ratingsCount || 0;
  const tScore = targetUser.trustScore || 0;
  const avg = rCount > 0 ? (tScore / rCount).toFixed(1) : (tScore > 0 ? tScore : '5.0');
  const badgeEl = document.getElementById('user-profile-rating-badge');

  if (badgeEl) {
    badgeEl.innerHTML = rCount > 0 ? `⭐ ${avg} / 5 (${rCount} értékelés)` : (tScore > 0 ? `⭐ ${tScore} pont` : `⭐ Új gyűjtő`);
  }

  const reviewsDetails = document.getElementById('user-profile-reviews-details');
  const reviewsCountEl = document.getElementById('user-profile-reviews-count');
  const reviewsListEl = document.getElementById('user-profile-reviews-list');

  if (reviewsDetails && reviewsCountEl && reviewsListEl) {
    reviewsListEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Értékelések betöltése...</span>';
    try {
      const snap = await db.collection("public_profiles").doc(uid).collection("reviews").orderBy("createdAt", "desc").limit(10).get();
      if (!snap.empty) {
        reviewsDetails.style.display = 'block';
        reviewsCountEl.textContent = snap.docs.length;
        reviewsListEl.innerHTML = snap.docs.map(doc => {
          const r = doc.data();
          return `
            <div class="review-bubble">
              <strong>${escapeHtml(r.fromName || 'Partner')}:</strong> ⭐ ${r.stars || 5}/5
              <div style="color:var(--sand); font-style:italic;">„${escapeHtml(r.comment || 'Minden rendben ment!')}”</div>
            </div>
          `;
        }).join('');
      } else if (rCount > 0) {
        reviewsDetails.style.display = 'block';
        reviewsCountEl.textContent = rCount;
        reviewsListEl.innerHTML = '<span style="font-size:0.75rem; color:var(--text-muted);">Sikeres cserékből jóváírt megbízhatósági pontok.</span>';
      } else {
        reviewsDetails.style.display = 'none';
      }
    } catch (e) { reviewsDetails.style.display = 'none'; }
  }

  const contactBtn = document.getElementById('btn-user-profile-contact');
  if (contactBtn) {
    contactBtn.onclick = () => {
      modal.classList.remove('open');
      openContactModal(targetUser, [], targetUser.van, targetUser.isGiftOffering);
    };
  }

  const mBox = document.getElementById('user-profile-missing-tags');
  const vBox = document.getElementById('user-profile-van-tags');
  if (mBox) {
    mBox.innerHTML = targetUser.allowInspect === false ? '<em>Elrejtve</em>' : (targetUser.kell?.length ? targetUser.kell.map(n => `<span style="display:inline-block; margin:2px; background:rgba(0,0,0,0.3); padding:2px 6px; border-radius:999px;">${getItemLabel(n)}</span>`).join('') : '<span style="color:var(--amber);">Minden megvan!</span>');
  }
  if (vBox) {
    vBox.innerHTML = targetUser.van?.length ? targetUser.van.map(n => `<span style="display:inline-block; margin:2px; background:rgba(216,155,74,0.2); color:var(--sand); padding:2px 6px; border-radius:999px;">${getItemLabel(n)}</span>`).join('') : '<em>Nincs dupla</em>';
  }

  modal.classList.add('open');
}

safeAddListener('btn-close-user-profile', () => document.getElementById('modal-user-profile')?.classList.remove('open'));
safeAddListener('btn-close-user-profile-2', () => document.getElementById('modal-user-profile')?.classList.remove('open'));

function triggerTopNotification(iconOrText, textOrActionFn, actionFn) {
  const banner = document.getElementById('top-notification-banner');
  const textEl = document.getElementById('top-banner-text');
  const actionBtn = document.getElementById('btn-top-banner-action');
  if (!banner || !textEl) return;
  textEl.textContent = typeof textOrActionFn === 'function' ? iconOrText : textOrActionFn;
  banner.style.display = 'flex';
  if (actionBtn) actionBtn.onclick = () => { banner.style.display = 'none'; if (typeof textOrActionFn === 'function') textOrActionFn(); else if (actionFn) actionFn(); };
  document.getElementById('btn-top-banner-close').onclick = () => banner.style.display = 'none';
}

function listenToMyMessages(uid) {
  if (!db) return;
  if (messagesUnsubscribe) messagesUnsubscribe();

  const refresh = () => {
    myIncomingMessages.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    myOutgoingMessages.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const unread = myIncomingMessages.filter(m => m.read !== true).length;
    const badge = document.getElementById('unread-msg-badge');
    const badgeM = document.getElementById('unread-msg-badge-m');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline-block' : 'none'; }
    if (badgeM) { badgeM.textContent = unread; badgeM.style.display = unread > 0 ? 'inline-block' : 'none'; }
    updateCserebereBadge();
    renderMessages();
  };

  const unsubIn = db.collection("messages").where("toUid", "==", uid).onSnapshot(snap => {
    myIncomingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.deletedByRecipient !== true);
    refresh();
  });
  const unsubOut = db.collection("messages").where("fromUid", "==", uid).onSnapshot(snap => {
    myOutgoingMessages = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.deletedBySender !== true);
    refresh();
  });
  messagesUnsubscribe = () => { unsubIn(); unsubOut(); };
}

// PROFIL TELEPÜLÉSEK
function renderProfileLocations() {
  const container = document.getElementById('profile-locations-list');
  const bpPicker = document.getElementById('bp-districts-picker');
  if (!container) return;

  if (!myProfile.locations || myProfile.locations.length === 0) {
    myProfile.locations = [{ city: myProfile.telepules || '', districts: [] }];
  }

  let hasBp = false;
  container.innerHTML = myProfile.locations.map((loc, idx) => {
    const isBp = (loc.city || '').toLowerCase().includes('budapest') || (loc.city || '').toLowerCase().includes('bp');
    if (isBp) hasBp = true;
    return `
      <div class="location-row" data-loc-idx="${idx}">
        <input type="text" class="input-field profile-location-input" list="hungarian-cities-list" data-idx="${idx}" value="${escapeHtml(loc.city)}" placeholder="${idx === 0 ? '1. Település (pl. Szeged vagy Budapest)' : 'További helyszín...'}" autocomplete="off">
        ${idx > 0 ? `<button class="btn btn-secondary btn-sm btn-del-location" data-idx="${idx}" type="button" style="color:var(--danger);">✕</button>` : ''}
      </div>
    `;
  }).join('');

  if (bpPicker) {
    bpPicker.style.display = hasBp ? 'block' : 'none';
    if (hasBp) renderBpDistrictChips();
  }
}

function renderBpDistrictChips() {
  const container = document.getElementById('bp-district-chips');
  if (!container) return;
  const bpLoc = (myProfile.locations || []).find(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
  const activeDists = new Set(bpLoc ? (bpLoc.districts || []) : []);

  container.innerHTML = ROMAN_NUMERALS.slice(1).map((name, idx) => {
    const dNum = idx + 1;
    return `<div class="bp-chip ${activeDists.has(dNum) ? 'active' : ''}" data-dist="${dNum}">${name} ker.</div>`;
  }).join('');
}

safeAddListener('bp-district-chips', 'click', (e) => {
  const chip = e.target.closest('.bp-chip');
  if (!chip) return;
  const dNum = parseInt(chip.dataset.dist, 10);
  const bpLoc = (myProfile.locations || []).find(l => (l.city || '').toLowerCase().includes('budapest') || (l.city || '').toLowerCase().includes('bp'));
  if (!bpLoc) return;
  if (!bpLoc.districts) bpLoc.districts = [];
  const idx = bpLoc.districts.indexOf(dNum);
  if (idx > -1) bpLoc.districts.splice(idx, 1); else bpLoc.districts.push(dNum);
  renderBpDistrictChips();
});

safeAddListener('profile-locations-list', 'input', (e) => {
  const input = e.target.closest('.profile-location-input');
  if (!input) return;
  const idx = parseInt(input.dataset.idx, 10);
  if (myProfile.locations[idx]) {
    myProfile.locations[idx].city = input.value.trim();
    renderProfileLocations();
  }
});

safeAddListener('profile-locations-list', 'click', (e) => {
  const btn = e.target.closest('.btn-del-location');
  if (btn) { myProfile.locations.splice(parseInt(btn.dataset.idx, 10), 1); renderProfileLocations(); }
});

safeAddListener('btn-add-location', () => {
  if (!myProfile.locations) myProfile.locations = [];
  if (myProfile.locations.length >= 5) return showToast("Maximum 5 helyszín.");
  myProfile.locations.push({ city: "", districts: [] });
  renderProfileLocations();
});

safeAddListener('btn-geo-detect-profile', () => requestGpsLocation());

// =========================================================================
// ADMIN: CHUNKED JSON IMPORTŐR, AI KÉP/SZÖVEG BEEMELŐ ÉS ABC CSOPORTOSÍTÁS
// =========================================================================

// 1. ADATBÁZIS INICIALIZÁLÁS (80+ ALBUM, BOLTLISTÁK ÉS LUTRA TÁJOLÁSOK)
safeAddListener('btn-admin-seed-database', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Feltöltöd mind a 80+ albumot, a 221 boltot és a Lutra 108 fejezeti tájolását a Firestore-ba?")) return;

  const btn = document.getElementById('btn-admin-seed-database');
  if (btn) { btn.disabled = true; btn.textContent = "Feltöltés folyamatban..."; }

  try {
    const allAlbumsList = Object.values(ALBUMS_REGISTRY);
    const CHUNK_SIZE = 400; // Biztonságos kötegméret

    for (let i = 0; i < allAlbumsList.length; i += CHUNK_SIZE) {
      const chunk = allAlbumsList.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach(alb => {
        batch.set(db.collection("albums").doc(alb.id), { ...alb, active: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    }

    // Boltok és Lutra fejezetek feltöltése
    const storeBatch = db.batch();
    Object.entries(STORE_DATABASES).forEach(([k, list]) => {
      storeBatch.set(db.collection("stores").doc(k), { chain: k, stores: list, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
    });
    storeBatch.set(db.collection("albums").doc("lidl-lutra-2026"), { customChaptersList: FEJEZETEK }, { merge: true });
    await storeBatch.commit();

    showToast("Sikeres inicializálás! Minden adat a Firestore felhőben van.");
  } catch (err) {
    showToast("Hiba: " + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Adatbázis inicializálása Firestore-ba most"; }
  }
});

// 2. JAVÍTOTT DARABOLT (CHUNKED) TÖMEGES JSON IMPORTŐR
safeAddListener('btn-admin-import-json', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  const rawJson = document.getElementById('admin-album-json-import')?.value.trim();
  if (!rawJson) return showToast("Illessz be érvényes JSON szöveget!");

  try {
    const parsed = JSON.parse(rawJson);
    const albums = Array.isArray(parsed) ? parsed : [parsed];
    const CHUNK_SIZE = 400;

    for (let i = 0; i < albums.length; i += CHUNK_SIZE) {
      const chunk = albums.slice(i, i + CHUNK_SIZE);
      const batch = db.batch();
      chunk.forEach(a => {
        if (!a.id || !a.title) throw new Error("Hiányzik az ID vagy Cím!");
        const entry = createAlbumEntry(a.id, a.title, a.publisher, a.year, a.totalItems, a.type, a.coverUrl, a);
        batch.set(db.collection("albums").doc(a.id), { ...entry, active: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    }

    document.getElementById('admin-album-json-import').value = '';
    showToast(`Sikeres! ${albums.length} db album felküldve a Firestore-ba.`);
  } catch (err) {
    showToast("JSON Import hiba: " + err.message);
  }
});

// 3. IGAZÁN OKOS UNIVERZÁLIS BEEMELŐ (GEMINI AI KÉP OCR + MULTI-FORMAT SZÖVEGPARSER)
safeAddListener('btn-admin-process-universal', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  const file = document.getElementById('admin-ai-ocr-file')?.files[0];
  const rawText = document.getElementById('admin-raw-import-text')?.value.trim() || '';
  const statusEl = document.getElementById('admin-universal-status');

  if (!file && !rawText) return showToast("Tölts fel képet VAGY másolj be szöveget!");

  if (statusEl) { statusEl.style.display = 'block'; statusEl.innerHTML = "Feldolgozás és adatok elemzése..."; }
  let extracted = rawText;

  if (file) {
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 1600;
            let w = img.width, h = img.height;
            if (w > maxDim || h > maxDim) {
              if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
              else { w = Math.round((w * maxDim) / h); h = maxDim; }
            }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
          };
          img.src = evt.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Tiszta POST kérés a Cloudflare Workernek (CORS hiba nélkül)
      const res = await fetch(WORKER_ENDPOINT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mode: 'table_ocr' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "A képfelismerő nem adott választ.");
      extracted = data.text || (data.numbers ? data.numbers.map(n => `${n}: Tétel ${n}`).join('\n') : '');
    } catch (err) {
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--danger);">AI Hiba: ${err.message}</span>`;
      return showToast("AI Hiba: " + err.message);
    }
  }

  // Multi-formátumú kinyerő (Kezeli a 1. Név, 1: Név, 1 - Név, tabulátoros sorokat is!)
  const namesList = expandCustomNamesText(extracted);
  const totalCount = namesList.length;

  if (document.getElementById('admin-album-custom-names')) document.getElementById('admin-album-custom-names').value = extracted;
  if (totalCount > 0 && document.getElementById('admin-album-total')) document.getElementById('admin-album-total').value = totalCount;

  if (statusEl) statusEl.innerHTML = `<span style="color:var(--moss-soft);">✓ Sikeresen kiolvasva! ${totalCount} tétel kitöltve a lenti űrlapon.</span>`;
  showToast(`${totalCount} tétel átemelve az űrlapba!`);
  document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

safeAddListener('btn-admin-clear-universal', () => {
  if (document.getElementById('admin-ai-ocr-file')) document.getElementById('admin-ai-ocr-file').value = '';
  if (document.getElementById('admin-raw-import-text')) document.getElementById('admin-raw-import-text').value = '';
  if (document.getElementById('admin-universal-status')) document.getElementById('admin-universal-status').style.display = 'none';
  showToast("Beemelő törölve.");
});

// 4. TELEPÜLÉSTISZTÍTÁS & TÖMEGES E-MAIL BEKAPCSOLÁS
safeAddListener('btn-admin-migrate-locations', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod.");
  if (!confirm("Bekapcsolod az automatikus e-mail értesítőket mind a 809+ tagnál?")) return;

  const btn = document.getElementById('btn-admin-migrate-locations');
  if (btn) { btn.disabled = true; btn.textContent = "Karbantartás..."; }

  try {
    const snap = await db.collection("public_profiles").get();
    let updatedCount = 0;
    const batch = db.batch();

    snap.docs.forEach(doc => {
      const data = doc.data();
      const rawInput = data.locations?.length ? data.locations : (data.telepules || '');
      const normalized = extractNormalizedLocations(rawInput);

      if (normalized.length > 0) {
        const cleanLocations = [];
        const bpDistricts = [];
        normalized.forEach(n => {
          if (n.canonicalKey.startsWith('budapest_')) bpDistricts.push(parseInt(n.canonicalKey.split('_')[1], 10));
          else if (n.canonicalKey === 'budapest') cleanLocations.push({ city: "Budapest", districts: [] });
          else cleanLocations.push({ city: n.displayName, districts: [] });
        });
        if (bpDistricts.length > 0) cleanLocations.unshift({ city: "Budapest", districts: [...new Set(bpDistricts)].sort((a,b)=>a-b) });

        const pretty = cleanLocations.map(l => l.districts?.length ? `${l.city} (${l.districts.map(d=>ROMAN_NUMERALS[d]+'.').join(', ')} ker.)` : l.city).join(', ');

        batch.set(db.collection("public_profiles").doc(doc.id), { locations: cleanLocations, telepules: pretty, emailNotifications: true }, { merge: true });
        batch.set(db.collection("users").doc(doc.id), { locations: cleanLocations, telepules: pretty, emailNotifications: true }, { merge: true });
        updatedCount++;
      }
    });

    await batch.commit();
    showToast(`Sikeres! ${updatedCount} felhasználónál aktiválva az e-mail.`);
  } catch (err) { showToast("Hiba: " + err.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = "Településtisztítás és e-mail bekapcsolása"; } }
});

// 5. ALBUMOK ABC CSOPORTOSÍTÁSA ÉS SZŰRÉSE
let adminSelectedLetter = 'ALL';

function renderAdminAlbumsList() {
  const container = document.getElementById('admin-albums-list');
  const abcBar = document.getElementById('admin-albums-abc-bar');
  const totalCountEl = document.getElementById('admin-albums-total-count');
  const query = (document.getElementById('admin-albums-search')?.value || '').toLowerCase().trim();
  if (!container) return;

  const allAlbums = Object.values(ALBUMS_REGISTRY).sort((a, b) => a.title.localeCompare(b.title, 'hu'));
  if (totalCountEl) totalCountEl.textContent = allAlbums.length;

  if (abcBar) {
    const letters = new Set();
    allAlbums.forEach(a => letters.add(a.title.charAt(0).toUpperCase()));
    abcBar.innerHTML = `
      <button class="admin-abc-btn ${adminSelectedLetter === 'ALL' ? 'active' : ''}" data-letter="ALL" style="width:auto; padding:0 8px;">Mind</button>
      ${[...letters].sort((a,b)=>a.localeCompare(b,'hu')).map(l => `<button class="admin-abc-btn ${adminSelectedLetter === l ? 'active' : ''}" data-letter="${l}">${l}</button>`).join('')}
    `;
  }

  let filtered = allAlbums.filter(a => {
    if (query) return (a.title || '').toLowerCase().includes(query) || (a.publisher || '').toLowerCase().includes(query) || a.id.includes(query);
    if (adminSelectedLetter !== 'ALL') return a.title.charAt(0).toUpperCase() === adminSelectedLetter;
    return true;
  });

  if (filtered.length === 0) { container.innerHTML = '<p style="padding:10px; color:var(--text-muted);">Nincs találat.</p>'; return; }

  const groups = {};
  filtered.forEach(a => {
    const l = a.title.charAt(0).toUpperCase();
    if (!groups[l]) groups[l] = [];
    groups[l].push(a);
  });

  let html = '';
  Object.keys(groups).sort((a,b)=>a.localeCompare(b,'hu')).forEach(l => {
    html += `<div class="admin-album-group-header"><span>${l}</span><span>${groups[l].length} db</span></div>`;
    groups[l].forEach(a => {
      html += `
        <div style="background:rgba(0,0,0,0.3); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <img src="${a.coverUrl || 'og-image.png'}" style="width:34px; height:34px; object-fit:contain; background:#F3EEDF; border-radius:4px; padding:2px;">
            <div><strong>${escapeHtml(a.title)}</strong> (${a.year}) <span style="font-size:0.75rem; color:var(--sand);">${a.totalItems} db</span></div>
          </div>
          <div style="display:flex; gap:4px;">
            <button class="btn btn-primary btn-sm" data-action="edit-album" data-id="${escapeHtml(a.id)}">Szerkesztés</button>
            <button class="btn btn-secondary btn-sm" data-action="toggle-feature-album" data-id="${escapeHtml(a.id)}">${a.featured ? 'Kiemelt le' : 'Kiemelés'}</button>
            <button class="btn btn-secondary btn-sm" data-action="delete-album" data-id="${escapeHtml(a.id)}" style="color:var(--danger);">Törlés</button>
          </div>
        </div>
      `;
    });
  });
  container.innerHTML = html;
}

safeAddListener('admin-albums-abc-bar', (e) => {
  const btn = e.target.closest('.admin-abc-btn');
  if (btn) { adminSelectedLetter = btn.dataset.letter; renderAdminAlbumsList(); }
});
safeAddListener('admin-albums-search', 'input', () => { adminSelectedLetter = 'ALL'; renderAdminAlbumsList(); });

safeAddListener('admin-albums-list', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const albumId = btn.dataset.id;
  const album = ALBUMS_REGISTRY[albumId];
  if (!album) return;

  if (btn.dataset.action === 'edit-album') {
    editingAlbumId = albumId;
    document.getElementById('admin-album-id').value = album.id;
    document.getElementById('admin-album-id').disabled = true;
    document.getElementById('admin-album-title').value = album.title;
    document.getElementById('admin-album-publisher').value = album.publisher;
    document.getElementById('admin-album-year').value = album.year;
    document.getElementById('admin-album-total').value = album.totalItems;
    document.getElementById('admin-album-type').value = album.type;
    document.getElementById('admin-album-subtitle').value = album.subtitle || '';
    document.getElementById('admin-album-custom-items').value = album.customItems?.join(', ') || '';
    document.getElementById('admin-album-custom-names').value = album.customNames?.map((n, i) => `${i+1}: ${n}`).join('\n') || '';
    document.getElementById('admin-album-featured').checked = album.featured === true;
    document.getElementById('admin-album-is-retro').checked = album.isRetro === true;
    document.getElementById('admin-album-radar-type').value = album.radarType || 'none';
    document.getElementById('btn-admin-cancel-edit').style.display = 'inline-block';
    document.getElementById('admin-album-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (btn.dataset.action === 'toggle-feature-album') {
    album.featured = !album.featured;
    await db.collection("albums").doc(albumId).set({ featured: album.featured }, { merge: true });
    renderHub(); renderAdminAlbumsList();
    showToast("Kiemelés frissítve.");
  } else if (btn.dataset.action === 'delete-album') {
    if (albumId === 'lidl-lutra-2026') return showToast("A Lutra alapalbum nem törölhető.");
    if (!confirm(`Törlöd a(z) ${albumId} gyűjteményt?`)) return;
    await db.collection("albums").doc(albumId).delete();
    delete ALBUMS_REGISTRY[albumId];
    renderHub(); renderAdminAlbumsList();
    showToast("Album törölve.");
  }
});

safeAddListener('btn-admin-cancel-edit', () => {
  editingAlbumId = null;
  document.getElementById('admin-album-id').value = '';
  document.getElementById('admin-album-id').disabled = false;
  document.getElementById('admin-album-title').value = '';
  document.getElementById('btn-admin-cancel-edit').style.display = 'none';
});

safeAddListener('btn-admin-save-album', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs jogosultságod.");
  const id = editingAlbumId || document.getElementById('admin-album-id')?.value.trim().toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '');
  const title = document.getElementById('admin-album-title')?.value.trim();
  const publisher = document.getElementById('admin-album-publisher')?.value.trim();
  const year = parseInt(document.getElementById('admin-album-year')?.value || '2026', 10);
  const totalItems = parseInt(document.getElementById('admin-album-total')?.value || '100', 10);
  const type = document.getElementById('admin-album-type')?.value || 'sticker';

  if (!id || !title) return showToast("Hiányzik az ID vagy Cím!");

  const customNames = expandCustomNamesText(document.getElementById('admin-album-custom-names')?.value || '');
  const customItems = expandCustomItemsText(document.getElementById('admin-album-custom-items')?.value || '');
  const finalTotal = customNames.length > totalItems ? customNames.length : totalItems;

  const entry = createAlbumEntry(id, title, publisher, year, finalTotal, type, ALBUMS_REGISTRY[id]?.coverUrl, {
    subtitle: document.getElementById('admin-album-subtitle')?.value.trim(),
    featured: document.getElementById('admin-album-featured')?.checked,
    isRetro: document.getElementById('admin-album-is-retro')?.checked,
    radarType: document.getElementById('admin-album-radar-type')?.value,
    hasRadar: document.getElementById('admin-album-radar-type')?.value !== 'none',
    customNames, customItems
  });

  await db.collection("albums").doc(id).set({ ...entry, active: true, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  ALBUMS_REGISTRY[id] = entry;
  editingAlbumId = null;
  document.getElementById('btn-admin-cancel-edit').style.display = 'none';
  renderHub(); renderAdminAlbumsList();
  showToast("Gyűjtemény sikeresen elmentve!");
});

// KÖZÖSSÉGI VÁRÓLISTA
function listenToSuggestions() {
  if (!db) return;
  db.collection("album_suggestions").where("status", "==", "pending").onSnapshot(snap => {
    albumSuggestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const b = document.getElementById('admin-suggestions-badge');
    if (b) b.textContent = albumSuggestions.length;
    const c = document.getElementById('admin-suggested-albums-list');
    if (c) c.innerHTML = albumSuggestions.length ? albumSuggestions.map(s => `
      <div style="background:rgba(0,0,0,0.3); padding:8px 10px; border-radius:var(--radius-sm); margin-bottom:6px; display:flex; justify-content:space-between;">
        <div><strong>${escapeHtml(s.title)}</strong><div style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(s.submittedByName || 'Gyűjtő')}</div></div>
        <button class="btn btn-primary btn-sm" onclick="db.collection('album_suggestions').doc('${s.id}').update({status:'approved'}); showToast('Jóváhagyva');">Jóváhagyás</button>
      </div>
    `).join('') : '<p style="font-size:0.8rem; color:var(--text-muted); margin:0;">Nincs javaslat.</p>';
  });
}

// RENDSZERÜZENETEK
safeAddListener('btn-admin-publish-msg', async () => {
  if (!currentUser || currentUser.email !== ADMIN_EMAIL) return showToast("Nincs admin jogosultságod!");
  const title = document.getElementById('admin-msg-title')?.value.trim();
  const content = document.getElementById('admin-msg-content')?.value.trim();
  const link = document.getElementById('admin-msg-link')?.value.trim();
  if (!title || !content) return showToast("Töltsd ki a címet és a szöveget!");

  await db.collection("announcements").add({
    title, content: link ? `${content}\n\nLink: ${link}` : content,
    active: true, createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('admin-msg-title').value = '';
  document.getElementById('admin-msg-content').value = '';
  showToast("Rendszerüzenet közzétéve!");
});

function listenToAnnouncements() {
  if (!db) return;
  db.collection("announcements").where("active", "==", true).onSnapshot(snap => {
    activeAnnouncements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const container = document.getElementById('admin-active-announcements');
    if (container) container.innerHTML = activeAnnouncements.map(a => `
      <div style="background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:var(--radius-sm); margin-bottom:4px; display:flex; justify-content:space-between;">
        <span><strong>${escapeHtml(a.title)}</strong></span>
        <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="db.collection('announcements').doc('${a.id}').update({active:false});">Leállítás</button>
      </div>
    `).join('');
  });
}

// VALÓS IDEJŰ ALBUM FIGYELŐ
function listenToAlbums() {
  if (!db) return;
  db.collection("albums").where("active", "==", true).onSnapshot(snap => {
    snap.docs.forEach(doc => {
      const d = doc.data();
      ALBUMS_REGISTRY[doc.id] = createAlbumEntry(doc.id, d.title, d.publisher, d.year, d.totalItems, d.type, d.coverUrl, d);
    });
    renderHub();
    if (currentUser && currentUser.email === ADMIN_EMAIL) renderAdminAlbumsList();
  });
}

// LENULLÁZÁS & OKLEVÉL
safeAddListener('btn-open-reset', () => document.getElementById('modal-reset')?.classList.add('open'));
safeAddListener('btn-close-reset', () => document.getElementById('modal-reset')?.classList.remove('open'));
safeAddListener('btn-reset-all', () => {
  myProfile.van = []; myProfile.vanCounts = {}; myProfile.kell = []; myProfile.foglalva = []; myProfile.foglalvaCounts = {};
  saveMyState();
  document.getElementById('modal-reset')?.classList.remove('open');
  showToast("Album sikeresen lenullázva.");
});

function downloadCertificateImage() {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 800;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 1200, 800);
  grad.addColorStop(0, '#0D2E2C'); grad.addColorStop(1, '#081B1A');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, 1200, 800);
  ctx.strokeStyle = '#D89B4A'; ctx.lineWidth = 10; ctx.strokeRect(30, 30, 1140, 740);
  ctx.textAlign = 'center'; ctx.fillStyle = '#FFD166'; ctx.font = 'bold 50px Georgia, serif';
  ctx.fillText('BOLYGÓVÉDŐ SZUPERHŐS OKLEVÉL', 600, 200);
  ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 64px "Work Sans", sans-serif';
  ctx.fillText(myProfile.nev || 'Gyűjtő', 600, 390);
  ctx.fillStyle = '#E3D5B8'; ctx.font = '26px "Work Sans", sans-serif';
  ctx.fillText('sikeresen összegyűjtötte a 2026-os Lidl Lutra album mind a 108 matricáját!', 600, 480);
  const link = document.createElement('a');
  link.download = `Lutra_Oklevel_${(myProfile.nev || 'Gyujto').replace(/\s+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast("Oklevél letöltve!");
}

safeAddListener('btn-view-certificate', () => {
  document.getElementById('cert-user-name').textContent = myProfile.nev || 'Gyűjtő';
  document.getElementById('modal-certificate')?.classList.add('open');
  if (window.confetti) confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
});
safeAddListener('btn-download-cert-img', downloadCertificateImage);
safeAddListener('btn-close-cert', () => document.getElementById('modal-certificate')?.classList.remove('open'));

// PROFIL MENTÉS & JEGYZET
safeAddListener('btn-save-note', () => {
  const note = (document.getElementById('prof-private-note')?.value || '').trim().slice(0, 250);
  myProfile.privateNote = note;
  localStorage.setItem(`private_note_${currentAlbumId}`, note);
  if (currentUser && db) {
    db.collection("public_profiles").doc(currentUser.uid).collection("collections").doc(currentAlbumId).set({ privateNote: note }, { merge: true });
  }
  showToast("Jegyzet elmentve.");
});

safeAddListener('btn-save-profile', () => {
  if (!currentUser) return showToast("Előbb lépj be!");
  const nev = document.getElementById('prof-nev')?.value.trim();
  const email = document.getElementById('prof-email')?.value.trim();
  if (!nev || !email) return showToast("Név és e-mail kitöltése kötelező!");

  myProfile.nev = nev; myProfile.email = email;
  myProfile.isGiftOffering = document.getElementById('prof-gift')?.checked || false;
  myProfile.showEmailToUsers = document.getElementById('prof-show-email')?.checked || false;
  myProfile.emailNotifications = document.getElementById('prof-email-notif')?.checked !== false;

  const validLocs = (myProfile.locations || []).filter(l => l.city && l.city.trim().length > 0);
  const pretty = validLocs.map(l => l.city).join(', ');
  myProfile.telepules = pretty;

  const batch = db.batch();
  batch.set(db.collection("users").doc(currentUser.uid), { nev, email, telepules: pretty, locations: validLocs, emailNotifications: myProfile.emailNotifications, isGiftOffering: myProfile.isGiftOffering, showEmailToUsers: myProfile.showEmailToUsers }, { merge: true });
  batch.set(db.collection("public_profiles").doc(currentUser.uid), { nev, email: myProfile.showEmailToUsers ? email : '', notifyEmail: email, telepules: pretty, locations: validLocs, emailNotifications: myProfile.emailNotifications, isGiftOffering: myProfile.isGiftOffering, showEmailToUsers: myProfile.showEmailToUsers }, { merge: true });

  batch.commit().then(() => showToast("Profil adatok elmentve."));
});

safeAddListener('btn-delete-account', () => {
  if (!currentUser || !confirm("Biztosan véglegesen törlöd az összes adatodat?")) return;
  const batch = db.batch();
  batch.delete(db.collection("users").doc(currentUser.uid));
  batch.delete(db.collection("public_profiles").doc(currentUser.uid));
  batch.commit().then(() => { localStorage.clear(); location.reload(); });
});

// AUTH ÉS BIZTONSÁGOS FIÓKVÁLTÁS
function initFirebase() {
  if (typeof firebase === 'undefined') return;
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyDatTdD6Ggcf7LbWZ0zBAyXf1JkspM6CEs",
      authDomain: "lutra-csereplatform.firebaseapp.com",
      databaseURL: "https://lutra-csereplatform-default-rtdb.europe-west1.firebasedatabase.app",
      projectId: "lutra-csereplatform",
      storageBucket: "lutra-csereplatform.firebasestorage.app",
      messagingSenderId: "311436055202",
      appId: "1:311436055202:web:010e622b11eb6c02f7fdfb"
    };

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();

    auth.onAuthStateChanged(user => {
      // Fiókváltáskor azonnal megállítjuk a háttérmentéseket!
      clearTimeout(saveDebounceTimer);
      lastLocalEditTimestamp = 0;
      currentUser = user;

      const authArea = document.getElementById('auth-area');
      const adminTab = document.getElementById('tab-admin');
      const adminTabM = document.getElementById('tab-admin-m');

      if (user) {
        document.getElementById('guest-notice').style.display = 'none';
        if (adminTab) adminTab.style.display = user.email === ADMIN_EMAIL ? 'flex' : 'none';
        if (adminTabM) adminTabM.style.display = user.email === ADMIN_EMAIL ? 'inline-block' : 'none';

        if (authArea) {
          authArea.innerHTML = `
            <div class="user-badge"><span>${escapeHtml(user.displayName || user.email.split('@')[0])}</span></div>
            <button class="btn btn-secondary btn-sm" id="btn-logout" style="padding:4px 8px; font-size:0.75rem;">Kilépés</button>
          `;
          document.getElementById('btn-logout').onclick = () => {
            clearTimeout(saveDebounceTimer);
            auth.signOut();
          };
        }
        document.getElementById('modal-auth')?.classList.remove('open');
        listenToMyProfile(user.uid);
        listenToMyMessages(user.uid);
        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();
        listenToAlbums();
        if (user.email === ADMIN_EMAIL) listenToSuggestions();
      } else {
        // TISZTA KIJELENTKEZÉS: Memória visszaállítása tiszta vendég módra
        if (myDocUnsubscribe) myDocUnsubscribe();
        if (messagesUnsubscribe) messagesUnsubscribe();
        myIncomingMessages = []; myOutgoingMessages = [];

        myProfile = {
          nev: "Vendég gyűjtő", telepules: "", locations: [{ city: "", districts: [] }],
          geo: myGpsCoords, email: "", isGiftOffering: false, showEmailToUsers: false,
          emailNotifications: true, allowInspect: true, gdprAccepted: true, trustScore: 0, ratingsCount: 0,
          privateNote: '', favorites: [9, 4, 35], van: [], vanCounts: {}, kell: [], foglalva: [], foglalvaCounts: {}, activeTrades: []
        };
        renderGrid();
        renderActiveTradesPanel();
        listenToAllUsers();
        listenToRadarReports();
        listenToMeetups();
        listenToAnnouncements();
        listenToAlbums();

        document.getElementById('guest-notice').style.display = 'flex';
        if (authArea) authArea.innerHTML = `<button class="btn btn-sm btn-primary" id="btn-open-auth">Belépés / Fiók</button>`;
        document.getElementById('btn-open-auth').onclick = () => document.getElementById('modal-auth')?.classList.add('open');
      }
      checkMandatoryProfile();
    });
  } catch (e) {}
}

function listenToMyProfile(uid) {
  if (!db) return;
  if (myDocUnsubscribe) myDocUnsubscribe();

  myDocUnsubscribe = db.collection("public_profiles").doc(uid).onSnapshot(async pubSnap => {
    // Ha az elmúlt 1500 ms-ban mi magunk kattintottunk, nem engedjük a szerveres felülírást
    if (Date.now() - lastLocalEditTimestamp < 1500) return;

    let pubData = pubSnap.exists ? pubSnap.data() : null;
    let userData = null;
    try { const uSnap = await db.collection("users").doc(uid).get(); if (uSnap.exists) userData = uSnap.data(); } catch (err) {}

    const parsed = extractUserData({ ...(userData || {}), ...(pubData || {}) }, uid, currentAlbumId);

    // KIZÁRÓLAG A FIRESTORE ADATAIT TÖLTJÜK BE A MEMÓRIÁBA!
    if (parsed) {
      myProfile = { ...myProfile, ...parsed };
      localStorage.setItem(`lutra_van_${currentAlbumId}`, JSON.stringify(myProfile.van));
      localStorage.setItem(`lutra_kell_${currentAlbumId}`, JSON.stringify(myProfile.kell));
      renderGrid();
      renderActiveTradesPanel();
      if (getActiveAlbum().type === 'sticker' && getActiveAlbum().hasChapters) renderAlbumChapter();

      const nI = document.getElementById('prof-nev'); if (nI) nI.value = myProfile.nev || '';
      const eI = document.getElementById('prof-email'); if (eI) eI.value = myProfile.email || '';
      const pNoteEl = document.getElementById('prof-private-note'); if (pNoteEl) pNoteEl.value = myProfile.privateNote || '';
      initFavoriteSelects();
      renderProfileLocations();
      checkMandatoryProfile();
    }
  });
}

function listenToAllUsers() {
  if (!db) return;
  if (allUsersUnsubscribe) allUsersUnsubscribe();
  allUsersUnsubscribe = db.collection("public_profiles").onSnapshot(snapshot => {
    allUsersData = [];
    snapshot.forEach(doc => {
      const parsed = extractUserData(doc.data(), doc.id, currentAlbumId);
      if (parsed && (parsed.van.length > 0 || parsed.kell.length > 0)) allUsersData.push(parsed);
    });
    renderMatches();
    renderProximityPartners();
    renderStatistics();
    if (leafletMapInstance) renderLeafletMarkers();
  });
}

function checkMandatoryProfile() {
  const warning = document.getElementById('profile-warning');
  const isMissing = !myProfile.nev || myProfile.nev === 'Vendég gyűjtő' || !myProfile.telepules || !myProfile.email;
  if (currentUser && isMissing && warning) warning.style.display = 'block';
  else if (warning) warning.style.display = 'none';
}

safeAddListener('btn-google-login', () => auth?.signInWithPopup(new firebase.auth.GoogleAuthProvider()));
safeAddListener('btn-email-login', () => {
  const em = document.getElementById('auth-email')?.value.trim();
  const pw = document.getElementById('auth-pass')?.value;
  auth?.signInWithEmailAndPassword(em, pw).catch(() => showToast("Hibás belépési adatok."));
});
safeAddListener('btn-email-signup', () => {
  const em = document.getElementById('auth-email')?.value.trim();
  const pw = document.getElementById('auth-pass')?.value;
  if (pw.length < 6) return showToast("A jelszó legalább 6 karakter legyen!");
  auth?.createUserWithEmailAndPassword(em, pw).then(() => showToast("Sikeres regisztráció!"));
});
safeAddListener('btn-close-auth', () => document.getElementById('modal-auth')?.classList.remove('open'));
safeAddListener('link-open-profile', () => switchView('profil'));

function checkDonablyReturningPrompt() {
  const count = parseInt(localStorage.getItem('cserelj_visit_count') || '0', 10) + 1;
  localStorage.setItem('cserelj_visit_count', count.toString());
  if (count >= 3 && !localStorage.getItem('cserelj_already_donated')) {
    setTimeout(() => document.getElementById('modal-donably-support')?.classList.add('open'), 2500);
  }
}
safeAddListener('btn-close-donably-modal', () => document.getElementById('modal-donably-support')?.classList.remove('open'));
safeAddListener('btn-donably-donate-click', () => {
  localStorage.setItem('cserelj_already_donated', 'true');
  document.getElementById('modal-donably-support')?.classList.remove('open');
});

function checkSystemUpdateEmailBanner() {
  if (!localStorage.getItem('cserelj_email_update_dismissed')) {
    document.getElementById('system-update-email-banner').style.display = 'flex';
  }
}
safeAddListener('btn-dismiss-email-banner', () => {
  document.getElementById('system-update-email-banner').style.display = 'none';
  localStorage.setItem('cserelj_email_update_dismissed', 'true');
});

document.addEventListener('click', (e) => {
  const img = e.target.closest('[data-action="open-lightbox"]');
  if (img) {
    document.getElementById('lightbox-full-image').src = img.src;
    document.getElementById('modal-image-lightbox')?.classList.add('open');
  }
});
document.getElementById('modal-image-lightbox')?.addEventListener('click', () => {
  document.getElementById('modal-image-lightbox')?.classList.remove('open');
});

// =========================================================================
// RENDSZERINDÍTÓ BOOT LOGIKA
// =========================================================================
try {
  attachStickerInteraction(document.getElementById('matrica-grid'));
  attachStickerInteraction(document.getElementById('album-chapter-content'));
  renderHub();
  renderGrid();
  renderActiveTradesPanel();
  initFavoriteSelects();
  initFirebase();
  listenToAlbums();
  checkDonablyReturningPrompt();
  checkSystemUpdateEmailBanner();
} catch (err) {
  console.error("Indítási hiba:", err);
}
