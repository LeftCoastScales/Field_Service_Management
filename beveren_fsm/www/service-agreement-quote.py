# beveren_fsm/www/service-agreement-quote.py
# Controller for the LCS Service Agreement Quote web page.
# Route: /service-agreement-quote
# Frappe serves this alongside service-agreement-quote.html automatically.
# Authentication is handled by Frappe — guests see the login page.

import frappe

def get_context(context):
    context.no_cache = 1
    context.show_sidebar = False
    context.title = "LCS Service Agreement Quote"
