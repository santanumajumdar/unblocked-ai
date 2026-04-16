import pandas as pd
try:
    df = pd.read_excel('book.xlsx')
    print("Headers:", df.columns.tolist())
    print("First row:", df.iloc[0].to_dict())
except Exception as e:
    print("Error:", e)
