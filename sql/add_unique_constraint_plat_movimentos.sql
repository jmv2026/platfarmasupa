ALTER TABLE public.plat_movimentos 
  ADD CONSTRAINT plat_movimentos_documento_num_linha_key UNIQUE (documento, num_linha);
