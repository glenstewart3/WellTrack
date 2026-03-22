import asyncio
import os
from collections import Counter
from motor.motor_asyncio import AsyncIOMotorClient

async def debug():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]

    # Unique dates in attendance_records
    all_dates = await db.attendance_records.distinct('date')
    print(f'Unique dates in attendance_records: {len(all_dates)}')
    if all_dates:
        print(f'Date range: {min(all_dates)} to {max(all_dates)}')
        print(f'First 10 dates: {sorted(all_dates)[:10]}')
    print()

    # How many students have records?
    students_with_records = await db.attendance_records.distinct('student_id')
    print(f'Students with attendance records: {len(students_with_records)}')

    # Distribution of records per student
    all_records = await db.attendance_records.find({}, {'_id': 0, 'student_id': 1}).to_list(100000)
    cnt = Counter(r['student_id'] for r in all_records)
    if cnt:
        values = list(cnt.values())
        print(f'Records per student: min={min(values)}, max={max(values)}, avg={sum(values)/len(values):.1f}')

    # Sample absence types
    sample_types = await db.attendance_records.distinct('am_status')
    print(f'AM status types (sample): {sample_types[:15]}')

    # School settings current_year
    s = await db.school_settings.find_one({}, {'_id': 0, 'current_year': 1})
    print(f'Settings current_year: {s}')

    # Check what the fallback would give for a specific student
    student = await db.students.find_one({'enrolment_status': 'active'}, {'_id': 0})
    if student:
        sid = student['student_id']
        records = await db.attendance_records.find({'student_id': sid}, {'_id': 0}).to_list(100)
        print(f'\nStudent: {student.get("first_name")} {student.get("last_name")}')
        print(f'Exception records: {len(records)}')
        # Old fallback: per-student records as denominator
        PRESENT_STATUSES = {"Present", "Late arrival, approved", "Late arrival at School", "Early departure, approved", "Early departure from School"}
        total_old = 0
        absent_old = 0.0
        exc_by_date = {r['date']: r for r in records}
        for rec in exc_by_date.values():
            am = (rec.get('am_status') or '').strip()
            pm = (rec.get('pm_status') or '').strip()
            if am or pm:
                total_old += 1
                am_abs = am and am not in PRESENT_STATUSES
                pm_abs = pm and pm not in PRESENT_STATUSES
                if am_abs and pm_abs:
                    absent_old += 1.0
                elif am_abs or pm_abs:
                    absent_old += 0.5
        if total_old:
            pct_old = (total_old - absent_old) / total_old * 100
            print(f'Old fallback: total={total_old}, absent={absent_old}, pct={pct_old:.1f}%')

        # New approach: use all unique dates from attendance_records
        all_school_days = sorted(all_dates)
        total_new = 0
        absent_new = 0.0
        excluded_types = set()  # from settings
        for day in all_school_days:
            if day not in exc_by_date:
                total_new += 1
            else:
                rec = exc_by_date[day]
                am = (rec.get('am_status') or '').strip()
                pm = (rec.get('pm_status') or '').strip()
                am_abs = am and am not in PRESENT_STATUSES and am not in excluded_types
                pm_abs = pm and pm not in PRESENT_STATUSES and pm not in excluded_types
                if am and am not in PRESENT_STATUSES and not am_abs:
                    pass  # excluded
                total_new += 1
                if am_abs and pm_abs:
                    absent_new += 1.0
                elif am_abs or pm_abs:
                    absent_new += 0.5
        if total_new:
            pct_new = (total_new - absent_new) / total_new * 100
            print(f'New fallback (using all unique dates): total={total_new}, absent={absent_new}, pct={pct_new:.1f}%')

asyncio.run(debug())
