-- Seed Instagram handles for SEC + SWAC schools in team_directory.
-- Source: each school's own athletics website (see the handle sheet). Review before running.
-- Only fills blanks; never overwrites a handle you set by hand. facebook_page is left empty
-- on purpose so captions fall back to the school name. Safe to re-run.

update public.team_directory set instagram_handle = 'auburnfootball' where id = 'af80cb61-7594-484c-9b39-862ca7cddaca' and instagram_handle is null; -- Auburn (football only)
update public.team_directory set instagram_handle = 'FloridaGators' where id = '1cd3cddd-dd0e-4f5d-9867-4c9e685505aa' and instagram_handle is null; -- Florida (main athletics)
update public.team_directory set instagram_handle = 'georgiafootball' where id = 'cba49db4-1da8-4fc3-8f4c-4fbffc00bc4e' and instagram_handle is null; -- Georgia (football only)
update public.team_directory set instagram_handle = 'ukathletics' where id = '32404ffd-8a43-4432-9fa5-13ec9132ec25' and instagram_handle is null; -- Kentucky (main athletics)
update public.team_directory set instagram_handle = 'lsufootball' where id = '925fd5a5-f130-42cc-9979-e4f2f8710865' and instagram_handle is null; -- LSU (football only)
update public.team_directory set instagram_handle = 'hailstate' where id = 'ac7959f3-c757-49bc-99a6-466923560ff1' and instagram_handle is null; -- Mississippi State (main athletics)
update public.team_directory set instagram_handle = 'mizzoufootball' where id = 'ea597604-0e46-4971-bdb7-989f246857ff' and instagram_handle is null; -- Missouri (football only)
update public.team_directory set instagram_handle = 'ou_athletics' where id = '9ee72361-621c-4823-93e2-61a73078d1f3' and instagram_handle is null; -- Oklahoma (main athletics)
update public.team_directory set instagram_handle = 'gamecockfb' where id = '884b32fa-5038-4d27-9500-f7edb7f6a5a6' and instagram_handle is null; -- South Carolina (football only)
update public.team_directory set instagram_handle = 'vol_sports' where id = '095e79c5-88dd-4040-a111-0270b908a42e' and instagram_handle is null; -- Tennessee (main athletics)
update public.team_directory set instagram_handle = 'texaslonghorns' where id = 'e3cfc877-17b6-4772-89af-2a9c08e332c6' and instagram_handle is null; -- Texas (main athletics)
update public.team_directory set instagram_handle = 'vucommodores' where id = 'f6104667-febb-49f6-8c13-c248ac83d0ce' and instagram_handle is null; -- Vanderbilt (main athletics)
update public.team_directory set instagram_handle = 'aamuathletics' where id = '4fb40101-c188-4f26-919f-82a0772d1cd7' and instagram_handle is null; -- Alabama A&M (main athletics)
update public.team_directory set instagram_handle = 'uapblionsroar' where id = 'bf9cd6d4-040a-4950-9b1b-35713a70fbbe' and instagram_handle is null; -- Arkansas-Pine Bluff (main athletics)
update public.team_directory set instagram_handle = 'BCU_Athletics' where id = '94f6fa55-0caf-40a9-a2a0-fd99460cfdc2' and instagram_handle is null; -- Bethune-Cookman (main athletics)
update public.team_directory set instagram_handle = 'FAMUFB' where id = '25a66a8f-6ec1-46eb-aae2-5f11cd609c8c' and instagram_handle is null; -- Florida A&M (football only)
update public.team_directory set instagram_handle = 'gramblingathletics' where id = '999c53ef-a374-4c80-865f-ba97ca6f4429' and instagram_handle is null; -- Grambling (main athletics)
update public.team_directory set instagram_handle = 'gojsutigers' where id = '79d97ddc-ffdd-45cd-b846-598c301716a8' and instagram_handle is null; -- Jackson State (main athletics)
update public.team_directory set instagram_handle = 'PVAMUPanthers' where id = '13b54e0f-d41b-4bf6-99ee-2d183afb0dc3' and instagram_handle is null; -- Prairie View A&M (main athletics)
update public.team_directory set instagram_handle = 'southernusports' where id = 'df7e5b7f-add7-4fd2-89ad-95548fd871c2' and instagram_handle is null; -- Southern (football only)
update public.team_directory set instagram_handle = 'tsufootball' where id = '1d758e34-ab71-44de-aaed-494db4420fbe' and instagram_handle is null; -- Texas Southern (football only)
