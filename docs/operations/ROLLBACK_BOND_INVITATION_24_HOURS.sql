-- Compensating rollback: future issuance only; never shorten issued invitations.
-- Keep the 24-hour CHECK to preserve all already-issued and historical rows.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '60s';
alter table public.bond_invitations alter column expires_at set default (now() + interval '5 minutes');
-- Keep the public lifecycle-lock wrapper, owner-row lock, token recovery and ACLs.
create or replace function private.before_deletion_create_bond_invitation() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner uuid := private.owner_atom(); inv public.bond_invitations; token text; encryption_key text; issued_at timestamptz;
begin
 perform 1 from public.atoms where id=owner for update;
 update public.bond_invitations set status='EXPIRED' where creator_atom_id=owner and status='ACTIVE' and expires_at<=clock_timestamp();
 delete from private.invitation_secrets s using public.bond_invitations i where s.invitation_id=i.id and i.creator_atom_id=owner and i.status<>'ACTIVE';
 select * into inv from public.bond_invitations where creator_atom_id=owner and status='ACTIVE';
 select secret into encryption_key from private.invitation_key;
 if inv.id is null then
  token := encode(extensions.gen_random_bytes(32),'hex');
  issued_at := clock_timestamp();
  insert into public.bond_invitations(creator_atom_id,token_hash,created_at,expires_at) values(owner,extensions.digest(token,'sha256'),issued_at,issued_at+interval '5 minutes') returning * into inv;
  insert into private.invitation_secrets values(inv.id,extensions.pgp_sym_encrypt(token,encryption_key));
 else
  select extensions.pgp_sym_decrypt(ciphertext,encryption_key) into token from private.invitation_secrets where invitation_id=inv.id;
 end if;
 update public.atoms set last_active_at=now(),status='ACTIVE' where id=owner;
 return jsonb_build_object('id',inv.id,'token',token,'createdAt',inv.created_at,'expiresAt',inv.expires_at,'status',inv.status);
end $$;
commit;
