SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict kX3GanxCFdjBNzvvC1cSGByY5Ktfu1Q2OBBrImiR6YOLl7SzDCY1F00B5vQcc2g

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: app_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."app_settings" ("setting_key", "setting_value", "updated_at") FROM stdin;
facebook_live_url	https://www.facebook.com/61558093540839/videos/1020680597068353	2026-06-14 16:24:24.103198
is_live_enabled	true	2026-06-14 16:24:24.112397
\.


--
-- Data for Name: casters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."casters" ("id", "name", "photo", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: maps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."maps" ("id", "name", "icon_path", "map_image", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: teams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."teams" ("id", "name", "shortname", "logo", "created_at", "updated_at") FROM stdin;
3	Top Kronoz	TKZ	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781739954264-team-logo-1781739951527.webp	2026-06-18 01:07:01.934667+00	2026-06-18 01:07:01.934667+00
4	Merciless Tribe Esports	MTE MAIN	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-19/1781845370575-team-logo-1781845369159.webp	2026-06-19 12:34:30.710945+00	2026-06-19 12:34:30.710945+00
5	MERCILESS TRIBE ESPORTS	MTE	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-19/1781842612771-team-logo-1781842611302.webp	2026-06-19 12:34:40.888186+00	2026-06-19 12:34:40.888186+00
\.


--
-- Data for Name: matches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."matches" ("id", "match_no", "blue_team_id", "red_team_id", "mode", "title", "caster_ids", "queue_order", "blue_score", "red_score", "status", "series_completed", "series_winner_team_id", "series_completed_at", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: games; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."games" ("id", "match_id", "game_no", "map_id", "status", "winner_team_id", "finished_at", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: draft_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."draft_sessions" ("id", "match_id", "game_id", "game_number", "blue_team_id", "red_team_id", "mode", "phase_index", "phase_label", "timer_remaining", "timer_running", "status", "started_at", "completed_at", "locked_at", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: heroes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."heroes" ("id", "name", "role", "lane", "image_path", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: draft_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."draft_actions" ("id", "draft_session_id", "game_id", "team_side", "action_type", "hero_id", "action_order", "phase_index", "phase_label", "slot_index", "locked", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: draft_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."draft_slots" ("id", "draft_session_id", "team_side", "slot_type", "slot_index", "phase_index", "phase_label", "hero_id", "hero_name", "hero_role", "hero_lane", "hero_image_path", "is_locked", "locked_at", "created_at", "updated_at") FROM stdin;
\.


--
-- Data for Name: overlay_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."overlay_settings" ("overlay_key", "is_enabled", "created_at", "updated_at") FROM stdin;
game_overlay	1	2026-06-11 14:22:12.404712+00	2026-06-11 14:22:12.404712+00
loading_overlay	1	2026-06-11 14:22:12.404712+00	2026-06-11 14:22:12.404712+00
\.


--
-- Data for Name: tournaments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."tournaments" ("id", "name", "slug", "game_type", "season", "description", "status", "banner_url", "logo_url", "start_date", "end_date", "is_active", "created_at", "updated_at", "cover_image_url", "logo_image_url") FROM stdin;
2	CMO BATTLEGROUNDS S1	cmo-battlegrounds-s1	CODM	Season 1	CMO BATTLEGROUNDS S1	ongoing			2026-06-15	2026-07-11	t	2026-06-14 16:42:45.012675	2026-06-16 17:18:31.511828	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/tournaments/2/cover-1781630305108-f0a97ec9-3cac-48ca-89be-8361232cbd7f.png	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/tournaments/2/logo-1781629582070-chatgpt-image-jun-6-2026-10_47_46-pm.png
1	CMO LEAGUE S1	cmo-league-s1	MLBB	Season 1	CMO MLBB LEAGUE S1	completed		https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/tournaments/1/logo-1781631741198-cmo-s1-logo.png	2026-05-24	2026-05-24	t	2026-06-14 16:42:01.245053	2026-06-16 17:42:24.833176		https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/tournaments/1/logo-1781631741198-cmo-s1-logo.png
\.


--
-- Data for Name: team_submissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."team_submissions" ("id", "team_name", "shortname", "captain_name", "contact", "logo_url", "notes", "status", "tournament_id", "created_at", "updated_at") FROM stdin;
1	FSR	FSR	Hatdog	01283123123213	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-16/1781631205648-fsr.jpg	HAHAHA	approved	\N	2026-06-16 17:33:42.413562	2026-06-16 17:34:06.261713
2	Exodia Ormin	EXO	Hatdog kami	Ako po si John Clarence	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781707478347-team-logo-1781707480205.webp	\N	rejected	\N	2026-06-17 14:45:09.431388	2026-06-17 14:45:35.01414
3	Zenith X	ZX	Adrian Anyayahan	09306517144	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781707885448-team-logo-1781707883210.webp	Hanzen Masongsong\nAdrian Anyayahan\nRon Nilz Adame \nStephen Barrientos \nSam Castillo	pending	\N	2026-06-17 14:52:49.488064	2026-06-17 14:52:49.488064
4	NOVEL ESPORTS	NVL	Arvin Macatangay	https://www.facebook.com/share/1BXYVQtf5c/	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781707887123-team-logo-1781707885988.webp	\N	pending	\N	2026-06-17 14:53:52.787328	2026-06-17 14:53:52.787328
5	Zenith X	ZX	Adrian Anyayahan	09306517144	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781708032137-team-logo-1781708029862.webp	Adrian Anyayahan\nHanzen Masongsong\nRon Nilz Adame\nStephen Barrientos \nSam Castillo	pending	\N	2026-06-17 14:54:43.829049	2026-06-17 14:54:43.829049
6	Eternal Esports	E8	Carlos Miguel	09518695700	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781708668754-team-logo-1781708665457.webp	“Infinite Skill. Eternal Legacy.”	pending	\N	2026-06-17 15:05:10.189173	2026-06-17 15:05:10.189173
7	Eternal Esports	E8	Carlos Miguel	09518695700	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781708826171-team-logo-1781708822975.webp	\N	pending	\N	2026-06-17 15:07:14.207381	2026-06-17 15:07:14.207381
8	Supreme Esports	SE	Yzabella Jonas	Yzabella Jonas	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781708697496-team-logo-1781762703772.webp	\N	pending	\N	2026-06-17 15:07:32.886826	2026-06-17 15:07:32.886826
9	New World Order	NWO, NW	Mclean Dilay	https://www.facebook.com/share/18cnEnxctd/?mibextid=wwXIfr	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781708878236-team-logo-1781708874810.webp	\N	pending	\N	2026-06-17 15:09:01.342292	2026-06-17 15:09:01.342292
10	Supreme Esports	SE	Yzabella Jonas	Yzabella Jonas	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781708922042-team-logo-1781762928502.webp	\N	pending	\N	2026-06-17 15:09:34.196062	2026-06-17 15:09:34.196062
11	ADMIRALS	ADM1	Kyle Sodela	09467552707	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709011318-team-logo-1781709009296.webp	None	pending	\N	2026-06-17 15:10:46.943935	2026-06-17 15:10:46.943935
12	Bengbeng Theory	BBT	Jonh Lenard Tañola	09360231451	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709108942-team-logo-1781709107584.webp	\N	pending	\N	2026-06-17 15:12:01.495962	2026-06-17 15:12:01.495962
13	Nexus Esports	NE	Zildjan Brent Dela Cruz	https://www.facebook.com/share/1bDFMEzCMJ/?mibextid=wwXIfr	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709164432-team-logo-1781709161444.webp	pa ban naman po ng pharo tazer hehe	pending	\N	2026-06-17 15:15:30.829812	2026-06-17 15:15:30.829812
14	ERiS Abyss	ERiS	Kenn Rayos	09504397925	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709371235-team-logo-1781709368856.webp	Wala napo	pending	\N	2026-06-17 15:16:53.258312	2026-06-17 15:16:53.258312
15	Zenith X	ZX	Adrian Anyayahan	09306517144	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709444262-team-logo-1781709442286.webp	Adrian Anyayahan\nHanzen Masongsong\nRon Nilz Adame\nStephen Barrientos \nSam Castillo	pending	\N	2026-06-17 15:18:01.030331	2026-06-17 15:18:01.030331
16	ERiS Abyss	ERiS	Kenn Rayos	09504397925	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709476167-team-logo-1781709473789.webp	KINO\nYOTCH\nBERTO\nKIO	pending	\N	2026-06-17 15:18:32.392931	2026-06-17 15:18:32.392931
17	TEAM OLAP	TO	Angelo Sarmiento	09610358708	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709695793-team-logo-1781709692656.webp	\N	pending	\N	2026-06-17 15:22:14.900896	2026-06-17 15:22:14.900896
18	CALAPAN FINEST TASK 141	CCF	JOHN CARL AMARILLAS	09194676048	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709709812-team-logo-1781709707544.webp	N/A	pending	\N	2026-06-17 15:22:26.869754	2026-06-17 15:22:26.869754
19	Nexus Esports	NE	Zildjan Brent Dela Cruz	09307079616	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709742304-team-logo-1781709738895.webp	Zildjan Dela Cruz, Wami San Pascual, Matt Aclan, Cyrus Felix, Gab Cuasay	pending	\N	2026-06-17 15:23:12.533989	2026-06-17 15:23:12.533989
20	CALAPAN FINEST TASK 141 MP TEAM	CCF	HANNAH LUCEÑO	09194676048	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709920213-team-logo-1781709917432.webp	N/A	pending	\N	2026-06-17 15:25:48.440177	2026-06-17 15:25:48.440177
21	CALAPAN FINEST TASK ROGUE	CCF	FREDDIE ASUNCION	09194676048	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781709976401-team-logo-1781709974630.webp	N/A	pending	\N	2026-06-17 15:26:37.605651	2026-06-17 15:26:37.605651
22	chronos	crs	Atashi Jinken	https://www.facebook.com/share/1H7hWLhzeT/?mibextid=wwXIfr	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781710093274-team-logo-1781709967820.webp	\N	pending	\N	2026-06-17 15:28:38.568326	2026-06-17 15:28:38.568326
23	Team Daddy Pao	DP	Ralph Vincent Magcamit	https://www.facebook.com/share/1BRDXScCxK/?mibextid=wwXIfr	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781710913697-team-logo-1781710910184.webp	Genozsx. \n6752633194538860545\n\nZetsu.\n6969178103457251329\n\n4KKYAMI. \n6935030942264197121\n\npąo\n6745072777247588353\n\ntotszxch\n6868164198707232769	pending	\N	2026-06-17 15:43:30.512065	2026-06-17 15:43:30.512065
24	InsaniTea	InsT	Joshua M. Opis	09285987964	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781714310225-team-logo-1781714307079.webp	\N	pending	\N	2026-06-17 16:38:58.649676	2026-06-17 16:38:58.649676
25	Morpheus Esports ft. Domel	M21	Domel Mañibo	https://www.facebook.com/share/19i7935CGk/?mibextid=wwXIfr	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781715428911-team-logo-1781715428019.webp	\N	pending	\N	2026-06-17 16:57:25.913836	2026-06-17 16:57:25.913836
26	InsaniTea	InsT	Joshua Opis	09285987964	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781728628872-team-logo-1781728625340.webp	\N	pending	\N	2026-06-17 20:37:18.891495	2026-06-17 20:37:18.891495
27	Sigbin	SGBN	Zybrel Mantuano	Zybrel Mantuano	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781731001969-team-logo-1781730998461.webp	\N	pending	\N	2026-06-17 21:17:06.049036	2026-06-17 21:17:06.049036
29	tl	tl	the goat	hatdog	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781740526886-team-logo-1781740525737.webp	\N	rejected	\N	2026-06-17 23:55:39.948257	2026-06-18 01:06:51.519823
28	Top Kronoz	TKZ	Ghiane	09271661876	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-17/1781739954264-team-logo-1781739951527.webp	\N	approved	\N	2026-06-17 23:46:48.124405	2026-06-18 01:07:01.942266
30	Fire Wolf Pro	FWP×	BERK	09817232968	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781753820631-team-logo-1781753817532.webp	\N	pending	\N	2026-06-18 03:37:57.754979	2026-06-18 03:37:57.754979
31	Fire Wolf Pro	FWP×	BERK	09817232968	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781782890502-team-logo-1781782887410.webp	\N	pending	\N	2026-06-18 11:41:59.196164	2026-06-18 11:41:59.196164
32	YC Build not kill	YC BNK	Kerwin Tumamak(BR), xyrus morillo (MP)	09755816426	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781784065746-team-logo-1781784063668.webp	Pinag isang gawa nanamin ang mp at br	pending	\N	2026-06-18 12:03:42.782572	2026-06-18 12:03:42.782572
33	TEAM CUTE	cute	kyle	09924401196	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781784795981-team-logo-1781784793557.webp	\N	pending	\N	2026-06-18 12:13:35.902866	2026-06-18 12:13:35.902866
34	SGBN MP	SGBN	ZYBREL MANTUANO	ZYBREL MANTUANO	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781788209639-team-logo-1781788206153.webp	\N	pending	\N	2026-06-18 13:10:20.90733	2026-06-18 13:10:20.90733
35	Supreme Esports	SE	Yzabella Jonas	Yzabella Jonas	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781789953724-team-logo-1781789949590.webp	Yzabella Jonas\nRysa Brillantes\nHanz Tria Dela Ombria\nEdmund Balintataw\nArvy Lugmao	pending	\N	2026-06-18 13:40:11.75024	2026-06-18 13:40:11.75024
36	Supreme Esports (br)	SE	Yzabella Jonas	Yzabella jonas	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781790130527-team-logo-1781790125836.webp	Nowel de castro\nIshaan pingol\nTyron Jio\nMarc Steven	pending	\N	2026-06-18 13:42:58.000175	2026-06-18 13:42:58.000175
37	dejavu	DJV	kayzer basilan	09952775525	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-18/1781792246487-team-logo-1781792244061.webp	1 kayzer basilan\n2 liann almazan\n3 lance faderanga\n4 eric panahon\n5 daniel evora\n6 zeki chua	pending	\N	2026-06-18 14:18:49.166074	2026-06-18 14:18:49.166074
40	UNCROWNED KINGS	UCK	patrick rodio	https://www.facebook.com/patrick.rodio.90	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-19/1781852353585-team-logo-1781852372540.webp	don't feel the pressure be the pressure	pending	\N	2026-06-19 07:05:06.69527	2026-06-19 07:05:06.69527
39	Merciless Tribe Esports	MTE MAIN	MTE Peewee	https://www.facebook.com/share/1GDnWa6FW8/	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-19/1781845370575-team-logo-1781845369159.webp	MTE Peewee\nMTE Ner\nMTE N4tsirt\nMTE Xeno	approved	\N	2026-06-19 05:03:51.78552	2026-06-19 12:34:30.725535
38	MERCILESS TRIBE ESPORTS	MTE	MTE Peewee	https://www.facebook.com/share/1GDnWa6FW8/	https://xlhkmjmlrnzknfbsuzrd.supabase.co/storage/v1/object/public/jeizi-storage/team-submissions/2026-06-19/1781842612771-team-logo-1781842611302.webp	\N	approved	\N	2026-06-19 04:18:16.366005	2026-06-19 12:34:40.891402
41	Test new cloadu	clod	hatdog	hatd	https://assets.cmotournaments.live/team-submissions/2026-06-19/1781885302391-team-logo-1781885305112.webp	\N	pending	\N	2026-06-19 16:08:31.586302	2026-06-19 16:08:31.586302
42	ARMIFERA FATUM	AF	Sofia Celerio	09515605746	https://assets.cmotournaments.live/team-submissions/2026-06-20/1781938621918-team-logo-1781938618439.webp	AF Eula\nAF Cael\nAF Tamed\nAF Jstn	pending	\N	2026-06-20 07:04:55.178499	2026-06-20 07:04:55.178499
\.


--
-- Data for Name: video_archives; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY "public"."video_archives" ("id", "tournament_id", "title", "description", "source_type", "source_url", "embed_url", "thumbnail_url", "video_type", "recorded_at", "sort_order", "is_featured", "is_published", "created_at", "updated_at") FROM stdin;
1	1	TEST	test	google_drive	https://drive.google.com/file/d/1xu_Ups5altZUkGZVf7nwGnWsC68O-kIh/view?usp=sharing	https://drive.google.com/file/d/1xu_Ups5altZUkGZVf7nwGnWsC68O-kIh/preview		match_replay	\N	0	f	t	2026-06-14 16:43:16.80564	2026-06-14 16:43:50.706711
2	1	Elimination Round		google_drive	https://drive.google.com/file/d/1q052xtByQUVamy-_geDx4eCG6fYJzX6N/view?usp=sharing	https://drive.google.com/file/d/1q052xtByQUVamy-_geDx4eCG6fYJzX6N/preview		match_replay	\N	0	f	t	2026-06-14 16:48:28.035478	2026-06-14 16:48:28.035478
3	1	Qualifiers		google_drive	https://drive.google.com/file/d/14pUj-Jk9zNEwcSXCMNHd60ckg4btqpu5/view?usp=drive_link	https://drive.google.com/file/d/14pUj-Jk9zNEwcSXCMNHd60ckg4btqpu5/preview		match_replay	\N	0	f	t	2026-06-14 16:49:08.518821	2026-06-14 16:49:08.518821
4	1	FINALS		google_drive	https://drive.google.com/file/d/1MRxM8g7CbVijHz4cmDfygppFc30dIlzr/view?usp=drive_link	https://drive.google.com/file/d/1MRxM8g7CbVijHz4cmDfygppFc30dIlzr/preview		match_replay	\N	0	f	t	2026-06-14 16:49:22.538029	2026-06-14 16:49:22.538029
\.


--
-- Name: casters_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."casters_id_seq"', 1, false);


--
-- Name: draft_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."draft_actions_id_seq"', 1, false);


--
-- Name: draft_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."draft_sessions_id_seq"', 1, false);


--
-- Name: draft_slots_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."draft_slots_id_seq"', 1, false);


--
-- Name: games_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."games_id_seq"', 1, false);


--
-- Name: heroes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."heroes_id_seq"', 1, false);


--
-- Name: maps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."maps_id_seq"', 1, false);


--
-- Name: matches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."matches_id_seq"', 1, false);


--
-- Name: team_submissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."team_submissions_id_seq"', 42, true);


--
-- Name: teams_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."teams_id_seq"', 5, true);


--
-- Name: tournaments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."tournaments_id_seq"', 2, true);


--
-- Name: video_archives_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."video_archives_id_seq"', 4, true);


--
-- PostgreSQL database dump complete
--

-- \unrestrict kX3GanxCFdjBNzvvC1cSGByY5Ktfu1Q2OBBrImiR6YOLl7SzDCY1F00B5vQcc2g

RESET ALL;
