import os
import json
import pandas as pd
import numpy as np

def parse_json_array(val):
    if not isinstance(val, str) or pd.isna(val):
        return []
    val = val.strip()
    if not val:
        return []
    # Replace double-escaped quotes if they exist (e.g. ""WRONG PARKING"")
    if '""' in val:
        val = val.replace('""', '"')
    try:
        parsed = json.loads(val)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed]
        return [str(parsed).strip()]
    except Exception:
        # Fallback regex-free parsing if json parsing fails
        cleaned = val.replace('[', '').replace(']', '').replace('"', '').replace("'", "")
        return [item.strip() for item in cleaned.split(',') if item.strip()]

def main():
    csv_path = "backend/dataset/jan to may police violation_anonymized791b166.csv"
    output_dir = "pipeline/output"
    output_path = os.path.join(output_dir, "violations_clean.csv")

    print(f"Loading dataset from: {csv_path}")
    # Load dataset
    df = pd.read_csv(csv_path, low_memory=False)
    print(f"Initial shape: {df.shape}")

    # 1. Filter only validation_status == 'approved' rows
    print("Filtering approved rows...")
    df = df[df['validation_status'] == 'approved'].copy()
    print(f"Filtered shape: {df.shape}")

    # Drop rows without latitude or longitude
    df = df.dropna(subset=['latitude', 'longitude'])
    df = df[(df['latitude'] != 0) & (df['longitude'] != 0)]
    print(f"Shape after filtering invalid coordinates: {df.shape}")

    # 2. Parse violation_type and offence_code JSON arrays into flat columns
    print("Parsing violation types and offence codes...")
    parsed_violations = df['violation_type'].apply(parse_json_array)
    parsed_offences = df['offence_code'].apply(parse_json_array)

    df['primary_violation'] = parsed_violations.apply(lambda x: x[0] if len(x) > 0 else 'UNKNOWN')
    df['violation_count_per_record'] = parsed_violations.apply(len)
    df['primary_offence_code'] = parsed_offences.apply(lambda x: x[0] if len(x) > 0 else 'UNKNOWN')

    # 3. Extract temporal features: hour of day, day of week from created_datetime
    print("Extracting temporal features...")
    df['created_datetime'] = pd.to_datetime(df['created_datetime'], errors='coerce')
    # Drop rows where created_datetime parsing failed
    df = df.dropna(subset=['created_datetime'])

    df['hour'] = df['created_datetime'].dt.hour
    df['day_of_week'] = df['created_datetime'].dt.dayofweek # 0=Monday, 6=Sunday
    
    # Peak hours (7-10am, 5-8pm)
    df['is_peak_hour'] = df['hour'].apply(lambda h: 1 if (7 <= h <= 10) or (17 <= h <= 20) else 0)

    # 4. Derive violation type weights
    weight_map = {
        'PARKING IN A MAIN ROAD': 1.0,
        'PARKING NEAR ROAD CROSSING': 0.85,
        'PARKING NEAR TRAFFIC LIGHT OR ZEBRA CROSS': 0.85,
        'PARKING NEAR BUSTOP/SCHOOL/HOSPITAL ETC': 0.80,
        'DOUBLE PARKING': 0.80,
        'PARKING ON FOOTPATH': 0.75,
        'WRONG PARKING': 0.75,
        'PARKING OPPOSITE TO ANOTHER PARKED VEHICLE': 0.70,
        'NO PARKING': 0.6
    }
    
    print("Mapping weights...")
    df['violation_weight'] = df['primary_violation'].map(weight_map).fillna(0.5)

    # 5. Flag junction proximity: near_junction = 1 if junction_name != "No Junction" and not empty
    print("Flagging junction proximity...")
    df['near_junction'] = df['junction_name'].apply(
        lambda jn: 1 if pd.notna(jn) and str(jn).strip() != "" and str(jn).strip().lower() != "no junction" and str(jn).strip().lower() != "null" else 0
    )

    # Keep only relevant columns to keep output tidy
    output_cols = [
        'id', 'latitude', 'longitude', 'location', 'vehicle_type', 'primary_violation',
        'violation_count_per_record', 'primary_offence_code', 'created_datetime',
        'hour', 'day_of_week', 'is_peak_hour', 'violation_weight', 'near_junction',
        'police_station', 'junction_name'
    ]
    
    # Ensure all output columns exist in DataFrame
    for col in output_cols:
        if col not in df.columns:
            df[col] = np.nan

    final_df = df[output_cols]

    print(f"Saving cleaned dataset to: {output_path}")
    os.makedirs(output_dir, exist_ok=True)
    final_df.to_csv(output_path, index=False)
    print("Phase 1 - Data Cleaning finished successfully!")
    print(f"Cleaned dataset shape: {final_df.shape}")

if __name__ == "__main__":
    main()
