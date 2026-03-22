import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def debug():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    # Check school_settings
    settings = await db.school_settings.find_one({}, {'_id': 0})
    current_year = settings.get('current_year') if settings else None
    excluded_types = settings.get('excluded_absence_types', []) if settings else []
    print('current_year:', current_year)
    print('excluded_absence_types:', excluded_types)
    print()

    # Check school_days
    years = await db.school_days.distinct('year')
    print('school_days years in DB:', years)
    total_days = await db.school_days.count_documents({})
    print('total school_days docs:', total_days)
    sample = await db.school_days.find({}, {'_id': 0}).limit(3).to_list(3)
    print('sample school_days:', sample)
    print()

    # Check attendance_records
    att_total = await db.attendance_records.count_documents({})
    print('total attendance_records:', att_total)
    att_dates = await db.attendance_records.distinct('date')
    att_years = sorted(set(int(d[:4]) for d in att_dates if d and len(d) >= 4))
    print('attendance record years:', att_years)
    sample_att = await db.attendance_records.find({}, {'_id': 0}).limit(3).to_list(3)
    print('sample attendance_records:', sample_att)
    print()

    # Check students
    student_count = await db.students.count_documents({'enrolment_status': 'active'})
    print('active students:', student_count)

    # Check for duplicate records (same student+date)
    pipeline = [
        {"$group": {"_id": {"student_id": "$student_id", "date": "$date"}, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$count": "duplicates"}
    ]
    dup_result = await db.attendance_records.aggregate(pipeline).to_list(1)
    print('duplicate student+date combos:', dup_result)
    print()

    # Pick first active student and trace their attendance
    first_student = await db.students.find_one({'enrolment_status': 'active'}, {'_id': 0})
    if first_student:
        sid = first_student['student_id']
        fname = first_student.get('first_name', '')
        lname = first_student.get('last_name', '')
        print(f'Tracing student: {fname} {lname} ({sid})')
        
        records = await db.attendance_records.find({'student_id': sid}, {'_id': 0}).to_list(100)
        print(f'  Total records: {len(records)}')
        if records:
            print(f'  Sample records: {records[:3]}')
        
        # School days for current year up to today
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).date().isoformat()
        if current_year:
            sd_filter = {"year": current_year, "date": {"$lte": today}}
        else:
            sd_filter = {"date": {"$lte": today}}
        school_days = await db.school_days.distinct('date', sd_filter)
        print(f'  School days for year {current_year} up to {today}: {len(school_days)}')

        # Manual compute
        PRESENT_STATUSES = {"Present", "Late arrival, approved", "Late arrival at School", "Early departure, approved", "Early departure from School"}
        FULL_PRESENT_STATUSES = {"Late arrival, approved", "Late arrival at School", "Early departure, approved", "Early departure from School"}
        exc_by_date = {r['date']: r for r in records}
        
        total_days = 0
        absent_days = 0.0
        excluded_set = set(excluded_types)
        
        for day in school_days:
            if day not in exc_by_date:
                total_days += 1
            else:
                rec = exc_by_date[day]
                am = (rec.get('am_status') or '').strip()
                pm = (rec.get('pm_status') or '').strip()
                
                def classify(s):
                    if not s: return 'present'
                    if s in excluded_set: return 'excluded'
                    if s == 'Present' or s in FULL_PRESENT_STATUSES: return 'present'
                    return 'absent'
                
                am_cls = classify(am)
                pm_cls = classify(pm)
                
                if am_cls == 'excluded' and pm_cls == 'excluded':
                    continue
                total_days += 1
                if am_cls == 'absent' and pm_cls == 'absent':
                    absent_days += 1.0
                elif am_cls == 'absent' or pm_cls == 'absent':
                    absent_days += 0.5
        
        if total_days > 0:
            pct = ((total_days - absent_days) / total_days) * 100
            print(f'  Manual calc: total_days={total_days}, absent_days={absent_days}, pct={pct:.1f}%')
        else:
            print('  No school days found - would show "no data"')

asyncio.run(debug())
