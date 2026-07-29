# Dashboard Data Limitations

- Product Category must not filter replenishment or machine-action metrics until transfer data has ProductId at line level.
- Fleet ON Machines is a current-status snapshot, not the count of machines with transactions in the selected period.
- Machines with Transactions is the time-context KPI based on Fact_Sales.
- REVIEW / REPLACE is a review recommendation only. Definitive replacement requires machine age, maintenance cost, downtime, fault history, and asset lifecycle data.
- Transfer TotalAmount valuation meaning must be confirmed before interpreting it as cost or inventory value.
- ProductId lineage in Fact_Sales must be documented and validated before product/category conclusions are treated as authoritative.