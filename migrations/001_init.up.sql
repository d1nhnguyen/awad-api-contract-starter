-- The menu service after IA#2: money is an integer number of dong.
CREATE TABLE menu_items (
  id        INTEGER PRIMARY KEY,
  name      TEXT    NOT NULL,
  price_vnd INTEGER NOT NULL CHECK (price_vnd > 0)
);

CREATE TABLE orders (
  id         INTEGER PRIMARY KEY,             -- grows with time: newest = largest
  table_id   INTEGER NOT NULL CHECK (table_id BETWEEN 1 AND 200),
  total_vnd  INTEGER NOT NULL CHECK (total_vnd > 0),
  created_at TEXT    NOT NULL                 -- ISO 8601, UTC
);

CREATE TABLE order_items (
  order_id       INTEGER NOT NULL REFERENCES orders(id),
  line           INTEGER NOT NULL,            -- 0, 1, 2 … in the order the client sent them
  menu_item_id   INTEGER NOT NULL REFERENCES menu_items(id),
  qty            INTEGER NOT NULL CHECK (qty > 0),
  unit_price_vnd INTEGER NOT NULL,            -- the price when the order was placed
  PRIMARY KEY (order_id, line)
);
