create or replace function public.reset_demo_data() returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c_tomas uuid; c_erdve uuid; c_cafe uuid;
  s_baltic uuid; s_nemunas uuid; s_steel uuid; s_nordic uuid; s_azuolas uuid; s_prokit uuid; s_stogas uuid; s_fitout uuid;
  cat_build uuid; cat_fitout uuid;
  k_ins uuid; k_fac uuid; k_win uuid; k_steel uuid; k_roof uuid; k_furn uuid; k_equip uuid; k_kits uuid;
  u_buyer uuid; u_designer uuid; u_cafe uuid; u_supplier uuid; u_furn uuid; u_admin uuid;
  p_cafe uuid; rfq_a uuid; rfq_b uuid; i_eps uuid; i_render uuid; i_win uuid;
  rr uuid; q uuid; qv uuid; ag uuid; ord uuid; pool uuid; past_rfq uuid; m int; n int;
  lines jsonb;
begin
  if auth.uid() is not null and not public.is_admin() then raise exception 'Admins only'; end if;

  insert into categories (slug, name_en, name_lt, "group", sort_order) values
    ('building-materials','Building materials','Statybinės medžiagos','build',1),
    ('interior-fitout','Interior & fit-out','Interjeras ir įrengimas','fitout',2)
  on conflict (slug) do update set name_en = excluded.name_en, name_lt = excluded.name_lt;
  select id into cat_build from categories where slug = 'building-materials';
  select id into cat_fitout from categories where slug = 'interior-fitout';
  insert into categories (parent_id, slug, name_en, name_lt, "group", default_unit, commission_group, sort_order, field_template) values
    (cat_build,'insulation','Insulation','Šiltinimas','build','m2','materials',1,
     '[{"key":"material","label":"Material","type":"select","options":["EPS","Stone wool","PIR","XPS"]},{"key":"grade","label":"Grade","type":"text","placeholder":"EPS 100"},{"key":"thickness_mm","label":"Thickness (mm)","type":"number"}]'),
    (cat_build,'facade-systems','Facade systems','Fasadų sistemos','build','m2','materials',2,
     '[{"key":"system","label":"System","type":"select","options":["Render (ETICS)","Ventilated facade","Cladding"]},{"key":"finish","label":"Finish / colour","type":"text"}]'),
    (cat_build,'windows-doors','Windows & doors','Langai ir durys','build','pcs','materials',3,
     '[{"key":"type","label":"Type","type":"select","options":["Window","Balcony door","Entrance door"]},{"key":"frame","label":"Frame","type":"select","options":["PVC","Wood","Aluminium","Wood-aluminium"]},{"key":"width_mm","type":"number","label":"Width (mm)"},{"key":"height_mm","type":"number","label":"Height (mm)"},{"key":"u_value","type":"number","label":"U-value (W/m²K)"}]'),
    (cat_build,'steel','Steel','Plienas','build','t','materials',4,
     '[{"key":"product","type":"select","label":"Product","options":["Rebar","Beam","Sheet","Tube","Stainless sheet"]},{"key":"grade","type":"text","label":"Grade","placeholder":"S355 / AISI 304"},{"key":"dimensions","type":"text","label":"Profile / dimensions"}]'),
    (cat_build,'roofing','Roofing','Stogai','build','m2','materials',5,
     '[{"key":"material","label":"Material","type":"select","options":["Metal tile","Bitumen membrane","Ceramic tile","Standing seam"]},{"key":"colour","label":"Colour","type":"text"}]'),
    (cat_fitout,'furniture','Furniture','Baldai','fitout','pcs','furniture_equipment',1,
     '[{"key":"item","type":"text","label":"Item","placeholder":"Dining table"},{"key":"dimensions","type":"text","label":"Dimensions (cm)"},{"key":"material","type":"text","label":"Material"},{"key":"finish","type":"text","label":"Finish / colour"},{"key":"use","type":"select","label":"Use","options":["Home","Commercial (heavy use)"]},{"key":"assembly","type":"bool","label":"Assembly / installation needed"}]'),
    (cat_fitout,'commercial-equipment','Commercial equipment','Komercinė įranga','fitout','pcs','furniture_equipment',2,
     '[{"key":"item","type":"text","label":"Equipment"},{"key":"power","type":"text","label":"Power / connection"},{"key":"dimensions","type":"text","label":"Dimensions (cm)"},{"key":"installation","type":"bool","label":"Installation needed"},{"key":"warranty_months_min","type":"number","label":"Minimum warranty (months)"}]'),
    (cat_fitout,'fitout-kits','Business fit-out kits','Verslo įrengimo komplektai','fitout','set','furniture_equipment',3,'[]')
  on conflict (slug) do update set parent_id = excluded.parent_id, name_en = excluded.name_en, name_lt = excluded.name_lt,
    default_unit = excluded.default_unit, commission_group = excluded.commission_group, field_template = excluded.field_template;
  select id into k_ins from categories where slug='insulation';
  select id into k_fac from categories where slug='facade-systems';
  select id into k_win from categories where slug='windows-doors';
  select id into k_steel from categories where slug='steel';
  select id into k_roof from categories where slug='roofing';
  select id into k_furn from categories where slug='furniture';
  select id into k_equip from categories where slug='commercial-equipment';
  select id into k_kits from categories where slug='fitout-kits';

  insert into kits (name, project_type, items) values
    ('Café, 40 seats','business_fitout', jsonb_build_array(
      jsonb_build_object('category_id',k_furn,'description','Café table 80×80, oak','specs','{"material":"Oak","use":"Commercial (heavy use)"}'::jsonb,'quantity_formula','seats/4','unit','pcs'),
      jsonb_build_object('category_id',k_furn,'description','Commercial bistro chair','specs','{"use":"Commercial (heavy use)"}'::jsonb,'quantity_formula','seats','unit','pcs'),
      jsonb_build_object('category_id',k_furn,'description','Bar counter','specs','{"dimensions":"400×60×110"}'::jsonb,'quantity_formula','1','unit','pcs'),
      jsonb_build_object('category_id',k_equip,'description','Combi oven','specs','{"installation":true}'::jsonb,'quantity_formula','1','unit','pcs'),
      jsonb_build_object('category_id',k_equip,'description','Refrigerated counter','specs','{}'::jsonb,'quantity_formula','2','unit','pcs'),
      jsonb_build_object('category_id',k_equip,'description','Extraction hood','specs','{"installation":true}'::jsonb,'quantity_formula','1','unit','pcs'))),
    ('Block renovation – facade insulation','renovation', jsonb_build_array(
      jsonb_build_object('category_id',k_ins,'description','EPS 100 facade insulation','specs','{"material":"EPS","grade":"EPS 100","thickness_mm":150}'::jsonb,'quantity_formula','facade_m2*1.05','unit','m2'),
      jsonb_build_object('category_id',k_fac,'description','Facade render system','specs','{"system":"Render (ETICS)"}'::jsonb,'quantity_formula','facade_m2','unit','m2'),
      jsonb_build_object('category_id',k_win,'description','Stairwell window, PVC','specs','{"type":"Window","frame":"PVC"}'::jsonb,'quantity_formula','floors','unit','pcs')))
  on conflict (name) do update set project_type = excluded.project_type, items = excluded.items;

  delete from companies where is_demo;

  insert into companies (type,name,company_code,city,buyer_segment,is_demo) values ('buyer','Tomas Renovacija UAB (demo)','300000001','Kaunas','contractor',true) returning id into c_tomas;
  insert into companies (type,name,company_code,city,buyer_segment,is_demo) values ('buyer','Studija Erdvė (demo)','300000002','Vilnius','designer',true) returning id into c_erdve;
  insert into companies (type,name,company_code,city,buyer_segment,is_demo) values ('buyer','Kavinė Laisvė (demo)','300000003','Kaunas','business',true) returning id into c_cafe;
  insert into buyer_reliability (company_id, score, rfqs_created, orders_completed) values (c_tomas,92,8,7),(c_erdve,80,2,1),(c_cafe,75,1,0);

  insert into companies (type,name,company_code,vat_code,country,city,is_claimed,claimed_at,is_demo,description) values
    ('supplier','Baltic Insulation UAB (demo)','300000101','LT100000101','LT','Kaunas',true,now(),true,'EPS, stone wool and ETICS facade systems.') returning id into s_baltic;
  insert into companies (type,name,company_code,vat_code,country,city,is_claimed,claimed_at,is_demo,description) values
    ('supplier','Nemunas Windows UAB (demo)','300000102','LT100000102','LT','Kaunas',true,now(),true,'PVC and aluminium windows and doors.') returning id into s_nemunas;
  insert into companies (type,name,company_code,vat_code,country,city,is_demo,description) values
    ('supplier','Vilnius Steel Trade UAB (demo)','300000103','LT100000103','LT','Vilnius',true,'Rebar, beams and sheet steel.') returning id into s_steel;
  insert into companies (type,name,company_code,vat_code,country,city,is_demo,description) values
    ('supplier','Nordic Materials Sp. z o.o. (demo)','PL5420000104','PL5420000104','PL','Białystok',true,'Insulation, steel and roofing from Poland.') returning id into s_nordic;
  insert into companies (type,name,company_code,vat_code,country,city,is_claimed,claimed_at,is_demo,description) values
    ('supplier','Ąžuolas Furniture UAB (demo)','300000105','LT100000105','LT','Kaunas',true,now(),true,'Solid oak furniture for homes and hospitality.') returning id into s_azuolas;
  insert into companies (type,name,company_code,vat_code,country,city,is_demo,description) values
    ('supplier','ProKitchen Equipment UAB (demo)','300000106','LT100000106','LT','Vilnius',true,'Commercial kitchen equipment with installation.') returning id into s_prokit;
  insert into companies (type,name,company_code,vat_code,country,city,is_demo,description) values
    ('supplier','Stogas Plus UAB (demo)','300000107','LT100000107','LT','Kaunas',true,'Roofing materials.') returning id into s_stogas;
  insert into companies (type,name,company_code,vat_code,country,city,is_demo,description) values
    ('supplier','FitOut Pro UAB (demo)','300000108','LT100000108','LT','Vilnius',true,'Turnkey business fit-out kits.') returning id into s_fitout;

  insert into supplier_categories values
    (s_baltic,k_ins),(s_baltic,k_fac),(s_nemunas,k_win),(s_steel,k_steel),(s_nordic,k_ins),(s_nordic,k_steel),(s_nordic,k_roof),
    (s_azuolas,k_furn),(s_prokit,k_equip),(s_stogas,k_roof),(s_fitout,k_kits),(s_fitout,k_furn);

  insert into supplier_profiles (company_id,regions_served,warehouse_locations,min_order_eur,typical_lead_time_days,installation_offered,warranty_months,response_rate,avg_response_hours,on_time_rate,avg_rating,review_count,certificates,pro_subscription) values
    (s_baltic,'{Kaunas,Vilnius,Klaipėda}','[{"city":"Kaunas","country":"LT"}]',300,5,false,24,0.95,4,0.97,4.8,23,'[{"name":"CE EPS 100","standard":"EN 13163"}]',true),
    (s_nemunas,'{Kaunas,Vilnius}','[{"city":"Kaunas","country":"LT"}]',500,21,true,60,0.9,8,0.93,4.6,41,'[{"name":"CE windows","standard":"EN 14351-1"}]',true),
    (s_steel,'{Vilnius,Kaunas}','[{"city":"Vilnius","country":"LT"}]',1000,7,false,12,0.8,12,0.9,4.3,9,'[{"name":"Mill certificate 3.1","standard":"EN 10204"}]',false),
    (s_nordic,'{Kaunas,Vilnius,Białystok}','[{"city":"Białystok","country":"PL"}]',1500,10,false,24,0.75,18,0.88,4.2,12,'[]',false),
    (s_azuolas,'{Kaunas,Vilnius}','[{"city":"Kaunas","country":"LT"}]',400,28,true,24,0.92,6,0.9,4.7,15,'[{"name":"FSC oak","standard":"FSC"}]',false),
    (s_prokit,'{Vilnius,Kaunas,Klaipėda}','[{"city":"Vilnius","country":"LT"}]',800,14,true,24,0.88,10,0.92,4.5,19,'[{"name":"CE equipment","standard":"EN 60335"}]',false),
    (s_stogas,'{Kaunas}','[{"city":"Kaunas","country":"LT"}]',200,7,true,12,0.6,30,0.75,3.6,4,'[]',false),
    (s_fitout,'{Vilnius,Kaunas}','[{"city":"Vilnius","country":"LT"}]',2000,30,true,24,0.85,12,0.89,4.4,7,'[]',false);

  insert into company_public_data (company_id,registered_date,activity_codes,employees,avg_wage,sodra_debt,tax_debt,vat_valid,tender_wins) values
    (s_baltic, current_date - interval '14 years','{46.73,23.99}',48,1850,false,false,true,6),
    (s_nemunas,current_date - interval '11 years','{22.23,46.73}',120,1700,false,false,true,2),
    (s_steel,  current_date - interval '8 years','{46.72}',25,1900,false,false,true,1),
    (s_nordic, current_date - interval '9 years','{46.73,46.72}',60,1600,false,false,true,0),
    (s_azuolas,current_date - interval '6 years','{31.01,31.09}',18,1550,false,false,true,0),
    (s_prokit, current_date - interval '10 years','{46.69,33.20}',30,1800,false,false,true,3),
    (s_stogas, current_date - interval '3 years','{43.91}',6,1200,false,true,true,0),
    (s_fitout, current_date - interval '5 years','{43.32,46.65}',14,1650,false,false,true,0),
    (c_tomas,  current_date - interval '7 years','{43.39}',22,1500,false,false,true,0),
    (c_erdve,  current_date - interval '4 years','{74.10}',5,1700,false,false,true,0),
    (c_cafe,   current_date - interval '1 year','{56.10}',9,1100,false,false,true,0);

  insert into trust_scores (company_id, score, breakdown, public_data_date) values
    (s_baltic,88,'{"seeded":true}',current_date),(s_nemunas,84,'{"seeded":true}',current_date),(s_steel,72,'{"seeded":true}',current_date),
    (s_nordic,66,'{"seeded":true}',current_date),(s_azuolas,76,'{"seeded":true}',current_date),(s_prokit,78,'{"seeded":true}',current_date),
    (s_stogas,31,'{"seeded":true}',current_date),(s_fitout,60,'{"seeded":true}',current_date);

  select id into u_buyer from profiles where email = 'buyer@demo.lt';
  select id into u_designer from profiles where email = 'designer@demo.lt';
  select id into u_cafe from profiles where email = 'cafe@demo.lt';
  select id into u_supplier from profiles where email = 'supplier@demo.lt';
  select id into u_furn from profiles where email = 'furniture@demo.lt';
  select id into u_admin from profiles where email = 'admin@demo.lt';
  update profiles p set company_id = x.cid, company_name = c.name, company_code = c.company_code, city = c.city,
      smart_id_verified = true, smart_id_verified_at = coalesce(p.smart_id_verified_at, now()), full_name = x.fname
    from (values (u_buyer,c_tomas,'Tomas Petrauskas'),(u_designer,c_erdve,'Eglė Kazlauskienė'),(u_cafe,c_cafe,'Laura Jonaitė'),
                 (u_supplier,s_baltic,'Mindaugas Baltrūnas'),(u_furn,s_azuolas,'Rokas Ąžuolinis')) x(uid,cid,fname)
    join companies c on c.id = x.cid
    where p.id = x.uid;
  update profiles set smart_id_verified = true, smart_id_verified_at = coalesce(smart_id_verified_at, now()), full_name = 'Demo Admin' where id = u_admin;
  insert into user_roles (user_id, role)
    select uid, r::app_role from (values (u_buyer,'buyer'),(u_designer,'buyer'),(u_cafe,'buyer'),(u_supplier,'supplier'),(u_furn,'supplier'),(u_admin,'admin')) v(uid,r)
    where uid is not null on conflict (user_id, role) do nothing;

  insert into projects (buyer_company_id,name,project_type,city,address) values (c_tomas,'Kavinė Laisvė fit-out','business_fitout','Kaunas','Laisvės al. 50, Kaunas') returning id into p_cafe;
  insert into rfqs (rfq_number,buyer_company_id,created_by,project_id,project_type,title,description,delivery_city,delivery_address,delivery_date_requested,delivery_week,status,submitted_at)
    values ('RFQ-2026-0001',c_tomas,u_buyer,p_cafe,'business_fitout','Café shell: insulation, render, windows','Facade and windows for the Kavinė Laisvė unit.','Kaunas','Laisvės al. 50, Kaunas',current_date+21,to_char(current_date+21,'IYYY-"W"IW'),'negotiating',now()-interval '5 days')
    returning id into rfq_a;
  insert into rfq_items (rfq_id,category_id,description,specs,quantity,unit,standard,sort_order,buyer_confirmed) values
    (rfq_a,k_ins,'EPS 100 facade insulation, 150 mm','{"material":"EPS","grade":"EPS 100","thickness_mm":150}',520,'m2','EN 13163',1,true) returning id into i_eps;
  insert into rfq_items (rfq_id,category_id,description,specs,quantity,unit,sort_order,buyer_confirmed) values
    (rfq_a,k_fac,'Facade render system (ETICS)','{"system":"Render (ETICS)","finish":"White silicone render"}',220,'m2',2,true) returning id into i_render;
  insert into rfq_items (rfq_id,category_id,description,specs,quantity,unit,sort_order,buyer_confirmed) values
    (rfq_a,k_win,'PVC window 1500×1500','{"type":"Window","frame":"PVC","width_mm":1500,"height_mm":1500,"u_value":0.9}',6,'pcs',3,true) returning id into i_win;
  insert into rfq_recipients (rfq_id,supplier_company_id,match_score,rank,status,viewed_at,responded_at,magic_token) values
    (rfq_a,s_baltic,0.92,1,'quoted',now()-interval '5 days',now()-interval '4 days',null),
    (rfq_a,s_nemunas,0.85,2,'viewed',now()-interval '4 days',null,null),
    (rfq_a,s_nordic,0.71,3,'sent',null,null,'demo-nordic-'||substr(md5(random()::text),1,16));
  select id into rr from rfq_recipients where rfq_id = rfq_a and supplier_company_id = s_baltic;
  insert into quotes (rfq_id,recipient_id,supplier_company_id,status,current_version,round_count) values (rfq_a,rr,s_baltic,'negotiating',3,2) returning id into q;
  insert into quote_versions (quote_id,version,party,lines,subtotal,delivery_cost,total,lead_time_days,warehouse_origin,valid_until,payment_terms,message,created_by,created_at) values
    (q,1,'supplier',jsonb_build_array(jsonb_build_object('rfq_item_id',i_eps,'unit_price',9.20,'quantity',520,'line_total',4784)),4784,180,4964,5,'Kaunas, LT',current_date+14,'Escrow','EPS 100 from stock, delivery Kaunas €180.',u_supplier,now()-interval '4 days'),
    (q,2,'buyer',jsonb_build_array(jsonb_build_object('rfq_item_id',i_eps,'unit_price',8.80,'quantity',600,'line_total',5280)),5280,0,5280,5,'Kaunas, LT',current_date+14,'Escrow','We can take 600 m² at €8.80 with free delivery.',u_buyer,now()-interval '3 days'),
    (q,3,'supplier',jsonb_build_array(jsonb_build_object('rfq_item_id',i_eps,'unit_price',8.90,'quantity',600,'line_total',5340)),5340,0,5340,5,'Kaunas, LT',current_date+14,'Escrow','€8.90/m² for 600 m², delivery included.',u_supplier,now()-interval '2 days');
  insert into messages (rfq_id,quote_id,recipient_id,sender_party,sender_profile_id,body,created_at) values
    (rfq_a,q,rr,'supplier',u_supplier,'Is the 150 mm thickness final, or would 200 mm be considered?',now()-interval '4 days 2 hours'),
    (rfq_a,q,rr,'buyer',u_buyer,'150 mm is final per the energy calculation.',now()-interval '4 days 1 hour');

  insert into rfqs (rfq_number,buyer_company_id,created_by,project_id,project_type,title,description,delivery_city,delivery_address,delivery_date_requested,delivery_week,status,source,submitted_at)
    values ('RFQ-2026-0002',c_cafe,u_cafe,null,'business_fitout','Café furniture and kitchen equipment','40-seat café, opening next month.','Kaunas','Laisvės al. 50, Kaunas',current_date+35,to_char(current_date+35,'IYYY-"W"IW'),'matched','kit',now()-interval '1 day')
    returning id into rfq_b;
  insert into rfq_items (rfq_id,category_id,description,specs,quantity,unit,sort_order,buyer_confirmed) values
    (rfq_b,k_furn,'Café table 80×80, oak','{"item":"Table","dimensions":"80×80×75","material":"Oak","use":"Commercial (heavy use)"}',10,'pcs',1,true),
    (rfq_b,k_furn,'Commercial bistro chair','{"item":"Chair","material":"Oak","use":"Commercial (heavy use)"}',40,'pcs',2,true),
    (rfq_b,k_furn,'Bar counter 4 m','{"item":"Bar counter","dimensions":"400×60×110","assembly":true}',1,'pcs',3,true),
    (rfq_b,k_equip,'Combi oven','{"item":"Combi oven","power":"400V","installation":true}',1,'pcs',4,true),
    (rfq_b,k_equip,'Refrigerated counter','{"item":"Refrigerated counter","dimensions":"180×70×85"}',2,'pcs',5,true),
    (rfq_b,k_equip,'Extraction hood','{"item":"Extraction hood","installation":true}',1,'pcs',6,true);
  insert into rfq_recipients (rfq_id,supplier_company_id,match_score,rank,status) values
    (rfq_b,s_azuolas,0.9,1,'sent'),(rfq_b,s_prokit,0.88,2,'sent'),(rfq_b,s_fitout,0.74,3,'sent');

  insert into group_buy_pools (supplier_company_id,category_id,product_name,product_specs,unit,base_price,tiers,region,delivery_week,deadline,min_qty,status)
    values (s_azuolas,k_furn,'Commercial bistro chair, oak','{"material":"Solid oak","use":"Commercial (heavy use)","seat_height_cm":46}','pcs',95,
      '[{"min_qty":100,"discount_pct":5},{"min_qty":200,"discount_pct":8},{"min_qty":300,"discount_pct":12}]','Kaunas',
      to_char(current_date+28,'IYYY-"W"IW'),now()+interval '10 days',100,'open') returning id into pool;
  insert into pool_members (pool_id,buyer_company_id,quantity,if_pool_fails) values (pool,c_tomas,80,'order_alone'),(pool,c_erdve,40,'cancel'),(pool,c_cafe,40,'order_alone');

  for m in 1..6 loop
    insert into rfqs (rfq_number,buyer_company_id,created_by,project_type,title,delivery_city,status,submitted_at,closed_at,created_at)
      values ('RFQ-2025-'||lpad((100+m)::text,4,'0'),c_tomas,u_buyer,'renovation','EPS insulation batch '||m,'Kaunas','closed',
        now()-make_interval(months=>m),now()-make_interval(months=>m)+interval '5 days',now()-make_interval(months=>m))
      returning id into past_rfq;
    lines := '[]';
    for n in 1..5 loop
      insert into rfq_items (rfq_id,category_id,description,specs,quantity,unit,sort_order,buyer_confirmed)
        values (past_rfq,k_ins,'EPS 100, '||(50*n)||' mm',jsonb_build_object('material','EPS','grade','EPS 100','thickness_mm',50*n),100,'m2',n,true)
        returning id into i_eps;
      lines := lines || jsonb_build_array(jsonb_build_object('rfq_item_id',i_eps,'unit_price',round((2.6*n + 1.4 + (m%3)*0.15)::numeric,2),'quantity',100,
        'line_total',round((2.6*n + 1.4 + (m%3)*0.15)::numeric*100,2)));
    end loop;
    insert into rfq_recipients (rfq_id,supplier_company_id,match_score,rank,status,responded_at) values (past_rfq,s_baltic,0.9,1,'selected',now()-make_interval(months=>m)) returning id into rr;
    insert into quotes (rfq_id,recipient_id,supplier_company_id,status,current_version,round_count) values (past_rfq,rr,s_baltic,'accepted',1,0) returning id into q;
    insert into quote_versions (quote_id,version,party,lines,subtotal,delivery_cost,total,lead_time_days,warehouse_origin,created_by,created_at)
      values (q,1,'supplier',lines,(select sum((l->>'line_total')::numeric) from jsonb_array_elements(lines) l),0,
        (select sum((l->>'line_total')::numeric) from jsonb_array_elements(lines) l),5,'Kaunas, LT',u_supplier,now()-make_interval(months=>m)+interval '1 day')
      returning id into qv;
    if m = 2 then
      insert into agreements (rfq_id,quote_id,quote_version_id,total,lead_time_days,payment_terms,buyer_signed_at,buyer_signature_code,supplier_signed_at,supplier_signature_code,status)
        select past_rfq,q,qv,total,5,'Escrow',now()-interval '2 months','4821',now()-interval '2 months','1937','signed' from quote_versions where id = qv
        returning id into ag;
      insert into orders (order_number,agreement_id,rfq_id,buyer_company_id,supplier_company_id,total,commission_rate,commission_amount,supplier_payout,payment_method,status,created_at)
        select 'ORD-2026-0001',ag,past_rfq,c_tomas,s_baltic,total,0.03,round(total*0.03,2),round(total*0.97,2),'escrow','completed',now()-interval '2 months' from agreements where id = ag
        returning id into ord;
      insert into payments (order_id,milestone,amount,status,held_at,released_at) select ord,'full',total,'released',now()-interval '2 months',now()-interval '7 weeks' from orders where id = ord;
      insert into order_events (order_id,status,note,created_by,created_at) values
        (ord,'paid_escrow','Payment held in escrow (demo)',u_buyer,now()-interval '2 months'),
        (ord,'shipped','Loaded at Kaunas warehouse',u_supplier,now()-interval '8 weeks'),
        (ord,'delivered','Delivered to site',u_supplier,now()-interval '7 weeks 2 days'),
        (ord,'completed','Buyer accepted delivery',u_buyer,now()-interval '7 weeks');
      insert into reviews (order_id,reviewer_company_id,supplier_company_id,rating,comment,created_at)
        values (ord,c_tomas,s_baltic,5,'On time, exact quantities, great communication.',now()-interval '7 weeks');
    end if;
  end loop;

  insert into notifications (profile_id,company_id,type,title,body,link) values
    (u_buyer,c_tomas,'quote_revised','Baltic Insulation sent a revised offer','€8.90/m² for 600 m², delivery included.','/app/rfqs'),
    (u_supplier,s_baltic,'counter_offer','Counter-offer on RFQ-2026-0001','Buyer proposed €8.80/m² for 600 m².','/supplier/quotes'),
    (u_furn,s_azuolas,'new_rfq','New RFQ: café furniture','RFQ-2026-0002 from Kavinė Laisvė.','/supplier/inbox'),
    (u_cafe,c_cafe,'pool_progress','Group Buy: bistro chairs','160 pcs joined — 40 more unlocks −8%.','/app/group-buy');

  insert into audit_log (entity, action, actor_profile_id, data) values ('demo','reset', auth.uid(), '{}');
  return jsonb_build_object('companies', (select count(*) from companies where is_demo));
end $$;
revoke execute on function public.reset_demo_data() from public, anon, authenticated;
grant execute on function public.reset_demo_data() to service_role;