#!/usr/bin/env -S awk -f

BEGIN {
    if (INPUT == "") {
        print "INPUT variable is required" > "/dev/stderr"
        exit 1
    }
    if (REPORT == "") {
        print "REPORT variable is required" > "/dev/stderr"
        exit 1
    }

    total_count = 0
    total_amount = 0
}

NR == 1 {
    next
}

{
    category = $2
    amount = $3 + 0

    total_count++
    total_amount += amount
    category_count[category]++
    category_sum[category] += amount
}

END {
    print "sales summary" > REPORT
    print "=============" >> REPORT
    print "rows: " total_count >> REPORT
    print "total_amount: " total_amount >> REPORT
    print "" >> REPORT
    print "by_category:" >> REPORT

    for (cat in category_count) {
        print "- " cat ": count=" category_count[cat] ", sum=" category_sum[cat] >> REPORT
    }

    print "[summarize_sales] read " INPUT > "/dev/stderr"
    print "[summarize_sales] wrote " REPORT > "/dev/stderr"
}