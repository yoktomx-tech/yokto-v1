DO $$
DECLARE uid uuid;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email='luishb.mzt@gmail.com';
  IF uid IS NULL THEN RETURN; END IF;
  DELETE FROM public.biometric_api_logs WHERE user_id=uid;
  DELETE FROM public.biometric_enrollments WHERE user_id=uid;
  DELETE FROM public.postal_code_lookups WHERE user_id=uid;
  DELETE FROM public.curp_verifications WHERE user_id=uid;
  DELETE FROM public.clabe_verifications WHERE user_id=uid;
  DELETE FROM public.kyc_documents WHERE user_id=uid;
  DELETE FROM public.verification_evidence WHERE uploaded_by=uid;
  DELETE FROM public.notifications WHERE user_id=uid;
  DELETE FROM public.audit_log WHERE user_id=uid;
  DELETE FROM public.dispute_messages WHERE author_id=uid OR dispute_id IN (SELECT id FROM public.disputes WHERE opened_by=uid);
  DELETE FROM public.disputes WHERE opened_by=uid;
  DELETE FROM public.transaction_events WHERE actor_id=uid OR transaction_id IN (SELECT id FROM public.transactions WHERE buyer_id=uid OR seller_id=uid);
  DELETE FROM public.transaction_conditions WHERE transaction_id IN (SELECT id FROM public.transactions WHERE buyer_id=uid OR seller_id=uid);
  DELETE FROM public.payouts WHERE seller_id=uid OR transaction_id IN (SELECT id FROM public.transactions WHERE buyer_id=uid OR seller_id=uid);
  DELETE FROM public.payment_intents WHERE transaction_id IN (SELECT id FROM public.transactions WHERE buyer_id=uid OR seller_id=uid);
  DELETE FROM public.transactions WHERE buyer_id=uid OR seller_id=uid;
  DELETE FROM public.connected_accounts WHERE user_id=uid;
  DELETE FROM public.api_clients WHERE owner_id=uid;
  DELETE FROM public.reports_ledger WHERE owner_id=uid;
  DELETE FROM public.user_roles WHERE user_id=uid;
  DELETE FROM public.profiles WHERE id=uid;
  DELETE FROM auth.users WHERE id=uid;
END $$;