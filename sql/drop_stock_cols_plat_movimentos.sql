ALTER TABLE public.plat_movimentos
  DROP COLUMN IF EXISTS estado_stock,
  DROP COLUMN IF EXISTS stock_anterior,
  DROP COLUMN IF EXISTS stock_actual,
  DROP COLUMN IF EXISTS stock_lot_anterior,
  DROP COLUMN IF EXISTS stock_arm_anterior,
  DROP COLUMN IF EXISTS stock_lot_actual,
  DROP COLUMN IF EXISTS stock_arm_actual,
  DROP COLUMN IF EXISTS stock_arm_lot_anterior,
  DROP COLUMN IF EXISTS stock_arm_lot_actual,
  DROP COLUMN IF EXISTS stock_loc_anterior,
  DROP COLUMN IF EXISTS stock_loc_actual,
  DROP COLUMN IF EXISTS stock_loc_lot_actual,
  DROP COLUMN IF EXISTS stock_loc_lot_anterior;
