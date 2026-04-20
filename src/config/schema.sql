-- ============================================================================
--  USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(254) NOT NULL UNIQUE,
  password        VARCHAR(255) NOT NULL,
  role            VARCHAR(30)  NOT NULL DEFAULT 'user',
  profile_picture TEXT,
  phone           VARCHAR(20),
  gender          VARCHAR(20),
  date_of_birth   DATE,
  address         VARCHAR(500),
  bio             VARCHAR(1000),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================================
--  COMPANIES (System Setting → Company)
-- ============================================================================
CREATE TABLE IF NOT EXISTS companies (
  id               SERIAL PRIMARY KEY,
  domain           VARCHAR(255) NOT NULL,
  company_name     VARCHAR(200) NOT NULL,
  copyright        VARCHAR(200) NOT NULL,
  left_logo        TEXT,
  right_logo       TEXT,
  meta_title       VARCHAR(150) NOT NULL,
  meta_description TEXT         NOT NULL,
  status           VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================================
--  REFRESH TOKENS
--  Stored as SHA-256 hashes so a DB leak doesn't expose usable tokens.
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash CHAR(64)    NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_user    ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);

-- ============================================================================
--  BANNERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS banners (
  id            SERIAL PRIMARY KEY,
  title         VARCHAR(255) NOT NULL,
  subtitle      VARCHAR(500),
  banner_type   VARCHAR(50),
  banner_for    VARCHAR(50),
  redirect_url  TEXT,
  start_date    DATE,
  end_date      DATE,
  display_order INTEGER      NOT NULL DEFAULT 0,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================================
--  SECTORS   (top of hierarchy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sectors (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  title         VARCHAR(255),
  subtitle      VARCHAR(500),
  hover_title   VARCHAR(255),
  sector_slug   VARCHAR(255) NOT NULL UNIQUE,
  card_color    VARCHAR(20),
  icon_color    VARCHAR(20),
  icon          TEXT,
  display_order INTEGER      NOT NULL DEFAULT 0,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================================
--  CATEGORIES   (belongs to a sector)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id             SERIAL PRIMARY KEY,
  sector_id      INTEGER      NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  hover_title    VARCHAR(255),
  category_slug  VARCHAR(255) NOT NULL UNIQUE,
  card_color     VARCHAR(20),
  icon_color     VARCHAR(20),
  category_icon  TEXT,
  display_status VARCHAR(10)  NOT NULL DEFAULT 'show',
  display_order  INTEGER      NOT NULL DEFAULT 0,
  status         VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_categories_sector ON categories(sector_id);

-- ============================================================================
--  INDICATORS   (belongs to a category — and therefore a sector)
-- ============================================================================
CREATE TABLE IF NOT EXISTS indicators (
  id             SERIAL PRIMARY KEY,
  sector_id      INTEGER      NOT NULL REFERENCES sectors(id) ON DELETE CASCADE,
  category_id    INTEGER      NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  hover_title    VARCHAR(255),
  card_color     VARCHAR(20),
  icon_color     VARCHAR(20),
  indicator_icon TEXT,
  display_order  INTEGER      NOT NULL DEFAULT 0,
  status         VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indicators_sector   ON indicators(sector_id);
CREATE INDEX IF NOT EXISTS idx_indicators_category ON indicators(category_id);

-- ============================================================================
--  KPIs   (belongs to an indicator)
-- ============================================================================
CREATE TABLE IF NOT EXISTS kpis (
  id                SERIAL PRIMARY KEY,
  sector_id         INTEGER      NOT NULL REFERENCES sectors(id)     ON DELETE CASCADE,
  category_id       INTEGER      NOT NULL REFERENCES categories(id)  ON DELETE CASCADE,
  indicator_id      INTEGER      NOT NULL REFERENCES indicators(id)  ON DELETE CASCADE,
  name              VARCHAR(255) NOT NULL,
  kpi_slug          VARCHAR(255) NOT NULL UNIQUE,
  description       TEXT,
  note              TEXT,
  hover_title       VARCHAR(255),
  data_source       VARCHAR(500),
  visualization_url TEXT,
  card_color        VARCHAR(20),
  icon_color        VARCHAR(20),
  kpi_icon          TEXT,
  value1            VARCHAR(100),
  value2            VARCHAR(100),
  value3            VARCHAR(100),
  show_value1       BOOLEAN      NOT NULL DEFAULT FALSE,
  show_value2       BOOLEAN      NOT NULL DEFAULT FALSE,
  show_value3       BOOLEAN      NOT NULL DEFAULT FALSE,
  display_status    VARCHAR(10)  NOT NULL DEFAULT 'show',
  display_order     INTEGER      NOT NULL DEFAULT 0,
  status            VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kpis_sector    ON kpis(sector_id);
CREATE INDEX IF NOT EXISTS idx_kpis_category  ON kpis(category_id);
CREATE INDEX IF NOT EXISTS idx_kpis_indicator ON kpis(indicator_id);
